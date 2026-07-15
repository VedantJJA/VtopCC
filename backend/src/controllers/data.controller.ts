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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
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
  const { session_id, semesterSubId } = req.body;
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

    const parsedData = parsers.parseCourseData(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
  } catch (error: any) {
    console.error('getTimetable failed:', error);
    return res.status(401).json({ status: 'error', message: error.message || 'Session expired or invalid.' });
  }
};

export const getAttendance = async (req: Request, res: Response) => {
  const { session_id, semesterSubId } = req.body;
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
  const { session_id, semesterSubId, classId, slot } = req.body;
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
  const { session_id, semesterSubId } = req.body;
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
  const { session_id, semesterSubId } = req.body;
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
  const { session_id, semesterSubId } = req.body;
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

export const getCalendar = async (req: Request, res: Response) => {
  const { session_id, semesterSubId, calDate } = req.body;
  try {
    const details = await getSessionDetails(session_id);
    const { client, authorizedId, csrfToken } = details;

    // 1. Get Class Group ID for this semester
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

    // 2. Fetch Calendar Date
    let dateStr = calDate;
    if (!dateStr) {
      // Default to 1st of current month
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const now = new Date();
      const monthStr = months[now.getMonth()];
      const year = now.getFullYear();
      dateStr = `01-${monthStr}-${year}`;
    }

    const payload = new URLSearchParams();
    payload.append('authorizedID', authorizedId);
    payload.append('_csrf', csrfToken);
    payload.append('calDate', dateStr);
    payload.append('semSubId', semesterSubId);
    payload.append('classGroupId', selectedGroup);
    payload.append('x', new Date().toUTCString());

    const response = await client.post('processViewCalendar', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const parsedData = parsers.parseAcademicCalendar(response.data);
    return res.json({ status: 'success', raw_data: parsedData });
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
