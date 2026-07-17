import { Request, Response } from 'express';
import { getSessionDetails } from '../services/vtop.service';
import * as parsers from '../services/parsers.service';

export const getSemesters = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('verifyMenu', 'true');

    const response = await client.post('academics/common/StudentTimeTableChn', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
      }
    });

    console.log('[DEBUG] getSemesters response length:', response.data.length);
    console.log('[DEBUG] Contains select#semesterSubId:', response.data.includes('semesterSubId'));
    console.log('[DEBUG] Contains vtopLoginForm:', response.data.includes('vtopLoginForm'));

    const cheerio = require('cheerio');
    const $ = cheerio.load(response.data);
    const semSelect = $('select#semesterSubId');
    const semesters: any[] = [];
    if (semSelect.length) {
      semSelect.find('option').each((_: any, opt: any) => {
        const val = $(opt).attr('value');
        if (val) {
          semesters.push({ id: val, name: $(opt).text().trim() });
        }
      });
    }

    console.log('[DEBUG] Parsed semesters count:', semesters.length);
    return res.json({ status: 'success', semesters });
  } catch (error: any) {
    console.error('getSemesters failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getTimetable = async (req: Request, res: Response) => {
  const { session_id, isSaturday, includeDayOrder } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('semesterSubId', semesterSubId);

    const response = await client.post('processViewTimeTable', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseCourseData(response.data) as any;

    if (isSaturday || includeDayOrder) {
      // Get all semesters for fallback switcher
      const session = sessionService.getSession(session_id);
      let allSemesters: any[] = [];
      if (session) {
        if (!session.semestersList || session.semestersList.length === 0) {
          const semesters = await fetchSemestersList(client, authorizedId, csrfToken);
          sessionService.updateSession(session_id, { semestersList: semesters });
          session.semestersList = semesters;
        }
        allSemesters = session.semestersList || [];
      }

      // Calculate upcoming Saturday's date
      const now = new Date();
      const day = now.getDay();
      const daysToAdd = (6 - day + 7) % 7;
      const upcomingSat = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      const dd = String(upcomingSat.getDate()).padStart(2, '0');
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const mmm = months[upcomingSat.getMonth()];
      const yyyy = upcomingSat.getFullYear();
      const satDateStr = `${dd}-${mmm}-${yyyy}`;

      console.log(`[SATURDAY PATCH] Upcoming Saturday date: ${satDateStr}`);

      let targetSemId = semesterSubId;
      let selectedGroup = await getClassGroupId(client, authorizedId, csrfToken, targetSemId);

      const calPayload = new URLSearchParams();
      calPayload.append('authorizedID', authorizedId);
      calPayload.append('_csrf', csrfToken);
      calPayload.append('calDate', satDateStr);
      calPayload.append('semSubId', targetSemId);
      calPayload.append('classGroupId', selectedGroup);
      calPayload.append('x', new Date().toUTCString());

      let calRes = await client.post('processViewCalendar', calPayload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      let calData = parsers.parseAcademicCalendar(calRes.data);

      // Backend Fallback Semester Loop (Step 3)
      if (!hasMeaningfulEvents(calData) && allSemesters.length > 0) {
        console.log(`[SATURDAY PATCH] Calendar date ${satDateStr} empty for sem ${targetSemId}. Checking fallbacks...`);
        for (const sem of allSemesters) {
          if (sem.id === targetSemId) continue;
          try {
            const candidateGroup = await getClassGroupId(client, authorizedId, csrfToken, sem.id);
            const retryPayload = new URLSearchParams();
            retryPayload.append('authorizedID', authorizedId);
            retryPayload.append('_csrf', csrfToken);
            retryPayload.append('calDate', satDateStr);
            retryPayload.append('semSubId', sem.id);
            retryPayload.append('classGroupId', candidateGroup);
            retryPayload.append('x', new Date().toUTCString());

            const retryRes = await client.post('processViewCalendar', retryPayload, {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const retryData = parsers.parseAcademicCalendar(retryRes.data);
            if (hasMeaningfulEvents(retryData)) {
              calData = retryData;
              targetSemId = sem.id;
              console.log(`[SATURDAY PATCH] Auto-switched to sem: ${sem.id}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Check Saturday day order in calendar events
      let dayOrderCode: string | null = null;
      const satDayNum = upcomingSat.getDate();
      const satDayObj = (calData.days || []).find((d: any) => d.day === satDayNum);
      if (satDayObj && satDayObj.events) {
        for (const event of satDayObj.events) {
          const text = (event.text || '').toUpperCase();
          if (text.includes('ORDER')) {
            if (text.includes('MON')) dayOrderCode = 'MON';
            else if (text.includes('TUE')) dayOrderCode = 'TUE';
            else if (text.includes('WED')) dayOrderCode = 'WED';
            else if (text.includes('THU')) dayOrderCode = 'THU';
            else if (text.includes('FRI')) dayOrderCode = 'FRI';
            if (dayOrderCode) break;
          }
        }
      }

      if (dayOrderCode && parsedData.timetable) {
        console.log(`[SATURDAY PATCH] Mapping Saturday timetable to ${dayOrderCode}`);
        parsedData.timetable['SAT'] = parsedData.timetable[dayOrderCode] || {};
        parsedData.day_order_active = dayOrderCode;
      }
    }

    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getTimetable failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getAttendance = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('semesterSubId', semesterSubId);

    const response = await client.post('processViewStudentAttendance', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseAttendanceSummary(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getAttendance failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getAttendanceDetail = async (req: Request, res: Response) => {
  const { session_id, classId, slot } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('lSemesterSubId', semesterSubId);
    payload.append('classId', classId);
    payload.append('slotName', slot);

    const response = await client.post('processViewAttendanceDetail', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseAttendanceDetail(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getAttendanceDetail failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getMarks = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('semesterSubId', semesterSubId);

    const response = await client.post('examinations/doStudentMarkView', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const parsedMarks = parsers.parseMarks(response.data);

    // Fetch credits from registered courses in timetable to attach them
    const timetableRes = await client.post('processViewTimeTable', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const courses = parsers.parseCourseData(timetableRes.data).courses || [];

    // Helper: attach credits
    const creditLookup = new Map<string, number>();
    courses.forEach((c: any) => {
      const key = `${c.course_code}_${(c.course_type || '').toLowerCase()}`;
      creditLookup.set(key, parseFloat(c.credits) || 0);
    });

    parsedMarks.forEach((course: any) => {
      const courseType = (course.type || '').toLowerCase();
      let credits = creditLookup.get(`${course.code}_${courseType}`);

      if (credits === undefined) {
        // Fallback checks
        for (const c of courses) {
          const registeredType = (c.course_type || '').toLowerCase();
          if (c.course_code === course.code) {
            const isLab1 = courseType.includes('lab') || courseType.endsWith('la');
            const isLab2 = registeredType.includes('lab') || registeredType.endsWith('la');
            const isTheory1 = courseType.includes('theory') || courseType.endsWith('th');
            const isTheory2 = registeredType.includes('theory') || registeredType.endsWith('th');
            
            if ((isLab1 && isLab2) || (isTheory1 && isTheory2)) {
              credits = parseFloat(c.credits) || 0;
              break;
            }
          }
        }
      }
      course.credits = credits !== undefined ? credits : 0.0;
    });

    // Group combined theory and lab scores
    const grouped: Record<string, any> = {};
    parsedMarks.forEach((course: any) => {
      const code = course.code;
      if (!code) return;

      if (!grouped[code]) {
        grouped[code] = {
          code,
          title: course.title || code,
          theory: null,
          lab: null
        };
      }

      const isLab = (course.type || '').toLowerCase().includes('lab') || (course.type || '').toLowerCase().endsWith('la');
      if (isLab) {
        grouped[code].lab = course;
      } else {
        grouped[code].theory = course;
      }
    });

    const combinedScores: any[] = [];
    Object.values(grouped).forEach((item: any) => {
      const theory = item.theory;
      const lab = item.lab;
      if (!theory || !lab) return;

      const theoryCredits = parseFloat(theory.credits) || 0;
      const labCredits = parseFloat(lab.credits) || 0;
      const totalCredits = theoryCredits + labCredits;

      if (totalCredits <= 0) return;

      const convertedScore = (
        (theoryCredits * (theory.total_obtained || 0)) +
        (labCredits * (lab.total_obtained || 0))
      ) / totalCredits;

      const convertedMax = (
        (theoryCredits * (theory.total_max_weightage || 0)) +
        (labCredits * (lab.total_max_weightage || 0))
      ) / totalCredits;

      // Helper check for FAT completion
      const hasCompletedFat = (course: any) => {
        return (course.assessments || []).some((a: any) => {
          const title = (a.title || '').toLowerCase();
          const isFat = title.includes('fat') || title.includes('final assessment') || title.includes('final assesment');
          if (!isFat) return false;
          const status = (a.status || '').trim().toLowerCase();
          return status === 'present' || !!a.weightage_mark || !!a.scored;
        });
      };

      const isFinalReady = hasCompletedFat(theory) && hasCompletedFat(lab);

      combinedScores.push({
        code: item.code,
        title: item.title,
        is_final_ready: isFinalReady,
        converted_score: Math.round(convertedScore * 100) / 100,
        converted_max: Math.round(convertedMax * 100) / 100,
        total_credits: Math.round(totalCredits * 100) / 100,
        theory: {
          credits: theoryCredits,
          score: theory.total_obtained,
          max: theory.total_max_weightage
        },
        lab: {
          credits: labCredits,
          score: lab.total_obtained,
          max: lab.total_max_weightage
        }
      });
    });

    return res.json({ status: 'success', raw_data: { courses: parsedMarks, combined_scores: combinedScores } });
  } catch (error: any) {
    console.error('getMarks failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getGrades = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    if (semesterSubId) {
      payload.append('semesterSubId', semesterSubId);
    }

    const response = await client.post('examinations/examGradeView/doStudentGradeView', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseGrades(response.data);

    // Fetch stats for each grade row
    const getGmtDateString = () => {
      return new Date().toUTCString();
    };

    for (const item of parsedData.grades) {
      const courseId = item.course_id;
      if (courseId) {
        try {
          const statsPayload = new URLSearchParams();
          statsPayload.append('authorizedID', authorizedId);
          statsPayload.append('x', getGmtDateString());
          statsPayload.append('semesterSubId', semesterSubId || '');
          statsPayload.append('courseId', courseId);
          statsPayload.append('_csrf', csrfToken);

          const statsRes = await client.post('examinations/examGradeView/getGradeViewDetails', statsPayload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          item.grade_statistics = parsers.parseGradeStatistics(statsRes.data);
        } catch (err) {
          console.warn(`Failed to fetch grade statistics for course ${courseId}:`, err);
        }
      }
    }

    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getGrades failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getExams = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('semesterSubId', semesterSubId);

    const response = await client.post('examinations/doSearchExamScheduleForStudent', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseExamSchedule(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getExams failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('verifyMenu', 'true');
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('nocache', '@(new Date().getTime())');

    const response = await client.post('studentsRecord/StudentProfileAllView', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseProfile(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getProfile failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

function hasMeaningfulEvents(calendarData: any): boolean {
  if (!calendarData || !Array.isArray(calendarData.days)) {
    return false;
  }
  for (const day of calendarData.days) {
    if (day && Array.isArray(day.events) && day.events.length > 0) {
      return true;
    }
  }
  return false;
}

async function getClassGroupId(client: any, authorizedId: string, csrfToken: string, semesterSubId: string): Promise<string> {
  let selectedGroup = 'ALL';
  try {
    const ttPayload = new URLSearchParams();
    ttPayload.append('authorizedID', authorizedId);
    ttPayload.append('_csrf', csrfToken);
    ttPayload.append('semesterSubId', semesterSubId);

    const ttRes = await client.post('processViewTimeTable', ttPayload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const pattern = /[A-Z0-9\+]+-[A-Z0-9]+-[A-Z]+-[A-Z0-9\.-]+-[A-Z0-9\.-]+-([A-Z0-9]+)/;
    const match = pattern.exec(ttRes.data);
    if (match) {
      selectedGroup = match[1];
    }
  } catch (err) {
    console.warn('Failed to extract Class Group ID, falling back to ALL:', err);
  }
  return selectedGroup;
}

async function fetchSemestersList(client: any, authorizedId: string, csrfToken: string): Promise<any[]> {
  try {
    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('verifyMenu', 'true');

    const response = await client.post('academics/common/StudentTimeTableChn', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
      }
    });

    const cheerio = require('cheerio');
    const $ = cheerio.load(response.data);
    const semSelect = $('select#semesterSubId');
    const semesters: any[] = [];
    if (semSelect.length) {
      semSelect.find('option').each((_: any, opt: any) => {
        const val = $(opt).attr('value');
        if (val) {
          semesters.push({ id: val, name: $(opt).text().trim() });
        }
      });
    }
    return semesters;
  } catch (err) {
    console.error('fetchSemestersList failed:', err);
    return [];
  }
}

import { sessionService } from '../services/session.service';

export const getCalendar = async (req: Request, res: Response) => {
  const { session_id, calDate } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const session = sessionService.getSession(session_id);
    if (!session) {
      throw new Error('Session not found in service.');
    }

    // --- 0. Fetch & Cache Semester List ---
    if (!session.semestersList || session.semestersList.length === 0) {
      const semesters = await fetchSemestersList(client, authorizedId, csrfToken);
      sessionService.updateSession(session_id, { semestersList: semesters });
      session.semestersList = semesters;
    }
    const allSemesters = session.semestersList || [];

    // --- 1. Cache Lookup for Target Semester ---
    let dateStr = calDate;
    if (!dateStr) {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const now = new Date();
      const monthStr = months[now.getMonth()];
      const year = now.getFullYear();
      dateStr = `01-${monthStr}-${year}`;
    }

    const monthKey = dateStr;
    let targetSemId = semesterSubId;

    if (!session.calendarCache) {
      session.calendarCache = {};
    }

    const cachedSem = session.calendarCache[monthKey];
    if (cachedSem) {
      console.log(`[DEBUG] Cache Hit: Using semester ${cachedSem} for ${monthKey}`);
      targetSemId = cachedSem;
    }

    // --- 2. Fetch Calendar ---
    let selectedGroup = await getClassGroupId(client, authorizedId, csrfToken, targetSemId);
    
    let payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('calDate', dateStr);
    payload.append('semSubId', targetSemId);
    payload.append('classGroupId', selectedGroup);
    payload.append('x', new Date().toUTCString());

    let response = await client.post('processViewCalendar', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    let parsedData = parsers.parseAcademicCalendar(response.data);
    let newSemesterId: string | null = null;

    // --- 3. Auto-Switch Logic (If Empty) ---
    if (!hasMeaningfulEvents(parsedData)) {
      console.log(`[DEBUG] Month ${dateStr} appears empty for sem ${targetSemId}. Checking others...`);
      for (const sem of allSemesters) {
        if (sem.id === targetSemId) continue;

        const candidateGroup = await getClassGroupId(client, authorizedId, csrfToken, sem.id);
        const retryPayload = new URLSearchParams();
        retryPayload.append('authorizedID', authorizedId);
        retryPayload.append('_csrf', csrfToken);
        retryPayload.append('calDate', dateStr);
        retryPayload.append('semSubId', sem.id);
        retryPayload.append('classGroupId', candidateGroup);
        retryPayload.append('x', new Date().toUTCString());

        try {
          const retryRes = await client.post('processViewCalendar', retryPayload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          const retryData = parsers.parseAcademicCalendar(retryRes.data);
          if (hasMeaningfulEvents(retryData)) {
            parsedData = retryData;
            targetSemId = sem.id;
            newSemesterId = sem.id;
            console.log(`[DEBUG] Auto-switched calendar semester to: ${sem.name || sem.id}`);
            if (session.calendarCache) {
              session.calendarCache[monthKey] = sem.id;
            }
            break;
          }
        } catch (e) {
          continue;
        }
      }
    } else {
      if (session.calendarCache) {
        session.calendarCache[monthKey] = targetSemId;
      }
    }

    // --- 4. Merge Exams (From ALL Semesters) ---
    try {
      const monthsMap: Record<string, number> = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
        JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
      };
      const dateParts = dateStr.split('-');
      const viewMonth = monthsMap[dateParts[1].toUpperCase()];
      const viewYear = parseInt(dateParts[2], 10);

      for (const sem of allSemesters) {
        const semId = sem.id;
        if (!semId) continue;

        try {
          const examPayload = new URLSearchParams();
          examPayload.append('authorizedID', authorizedId);
          examPayload.append('_csrf', csrfToken);
          examPayload.append('semesterSubId', semId);

          const examRes = await client.post('examinations/doSearchExamScheduleForStudent', examPayload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          const examSchedule = parsers.parseExamSchedule(examRes.data);

          for (const exam of examSchedule) {
            try {
              const exDateParts = exam.exam_date.split('-');
              const exDay = parseInt(exDateParts[0], 10);
              const exMonth = monthsMap[exDateParts[1].toUpperCase()];
              const exYear = parseInt(exDateParts[2], 10);

              if (exMonth === viewMonth && exYear === viewYear) {
                if (parsedData && Array.isArray(parsedData.days)) {
                  for (const dayObj of parsedData.days) {
                    if (dayObj.day === exDay) {
                      dayObj.status = 'exam';
                      if (Array.isArray(dayObj.events)) {
                        dayObj.events = dayObj.events.filter((e: any) => 
                          !e.text.toLowerCase().includes('holiday') && 
                          !e.text.toLowerCase().includes('no instructional')
                        );
                        
                        const examTypeLabel = exam.exam_type || 'Exam';
                        const eventText = `${examTypeLabel}: ${exam.course_code} (${exam.slot})`;
                        
                        if (!dayObj.events.some((e: any) => e.text === eventText)) {
                          dayObj.events.push({ text: eventText });
                        }
                      }
                    }
                  }
                }
              }
            } catch (exErr) {
              continue;
            }
          }
        } catch (semExamErr) {
          console.warn(`[DEBUG] Exam fetch warning for sem ${semId}:`, semExamErr);
        }
      }
    } catch (mergeErr) {
      console.error('[DEBUG] Exam merge error:', mergeErr);
    }

    const responsePayload: any = { status: 'success', raw_data: parsedData };
    if (newSemesterId) {
      responsePayload.new_semester_id = newSemesterId;
    }

    return res.json(responsePayload);
  } catch (error: any) {
    console.error('getCalendar failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getCredentials = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('verifyMenu', 'true');
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('nocache', '@(new Date().getTime())');

    const response = await client.post('proctor/viewStudentCredentials', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseCredentials(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getCredentials failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getDebugData = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('verifyMenu', 'true');
    payload.append('nocache', `@(${Date.now()})`);

    const response = await client.post('academics/common/StudentTimeTableChn', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return res.json({
      status: 'success',
      authorizedId,
      csrfToken,
      cookies: client.defaults.headers['Cookie'],
      rawHtml: response.data
    });
  } catch (error: any) {
    console.error('getDebugData failed:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getODSnapshot = async (req: Request, res: Response) => {
  const { session_id } = req.body;
  const semesterSubId = (req.body.semesterId || req.body.semesterSubId || req.query.semesterId || req.query.semesterSubId) as string;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('semesterSubId', semesterSubId);

    const summaryRes = await client.post('processViewStudentAttendance', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const courses = parsers.parseAttendanceSummary(summaryRes.data);
    let totalOd = 0;

    for (const course of courses) {
      if (!course.class_id || !course.slot_param) continue;
      const isLab = course.course_type?.toUpperCase().includes('LAB');

      const detailPayload = new URLSearchParams();
      detailPayload.append('authorizedID', authorizedId);
      detailPayload.append('_csrf', csrfToken);
      detailPayload.append('lSemesterSubId', semesterSubId);
      detailPayload.append('classId', course.class_id);
      detailPayload.append('slotName', course.slot_param);

      try {
        const detailRes = await client.post('processViewAttendanceDetail', detailPayload, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const detailsList = parsers.parseAttendanceDetail(detailRes.data);
        for (const d of detailsList) {
          if (d.status === 'On Duty') {
            totalOd += isLab ? 2 : 1;
          }
        }
      } catch (err) {
        // Ignore individual failures
      }
    }

    return res.json({ status: 'success', total_od_count: totalOd });
  } catch (error: any) {
    console.error('getODSnapshot failed:', error);
    return res.status(error.message === 'Session expired or invalid.' ? 401 : 500).json({
      status: 'error',
      message: error.message || 'Failed to fetch OD count'
    });
  }
};
