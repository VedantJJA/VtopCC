import * as cheerio from 'cheerio';

export interface ProfileData {
  personal: Record<string, string>;
  educational: Record<string, string>;
  family: {
    father: Record<string, string>;
    mother: Record<string, string>;
  };
  proctor: Record<string, string>;
  hostel: Record<string, string>;
}

export function parseProfile(htmlContent: string): ProfileData {
  const $ = cheerio.load(htmlContent || '');
  const profileData: ProfileData = {
    personal: {},
    educational: {},
    family: { father: {}, mother: {} },
    proctor: {},
    hostel: {}
  };

  function getRowValue($table: cheerio.Cheerio<any>, keyName: string): string {
    let result = 'N/A';
    $table.find('td').each((_, td): any => {
      const text = $(td).text().trim().toLowerCase();
      if (text.includes(keyName.toLowerCase())) {
        const value = $(td).next('td').text().trim();
        if (value) {
          result = value;
          return false; // break loop
        }
      }
    });
    return result;
  }

  // Personal Info
  const $collapseOne = $('#collapseOne');
  if ($collapseOne.length) {
    profileData.personal = {
      name: getRowValue($collapseOne, 'STUDENT NAME'),
      app_no: getRowValue($collapseOne, 'APPLICATION NUMBER'),
      dob: getRowValue($collapseOne, 'DATE OF BIRTH'),
      gender: getRowValue($collapseOne, 'GENDER'),
      blood_group: getRowValue($collapseOne, 'BLOOD GROUP'),
      email: getRowValue($collapseOne, 'EMAIL'),
      mobile: getRowValue($collapseOne, 'MOBILE NUMBER'),
      native_state: getRowValue($collapseOne, 'NATIVE STATE')
    };
    const $img = $('img.img.border.border-primary');
    if ($img.length) {
      profileData.personal.photo_url = $img.attr('src') || '';
    }
  }

  // Educational Info
  const $collapseTwo = $('#collapseTwo');
  if ($collapseTwo.length) {
    profileData.educational = {
      reg_no: getRowValue($collapseTwo, 'REGISTER NO'),
      school: getRowValue($collapseTwo, 'SCHOOL NAME'),
      board: getRowValue($collapseTwo, 'BOARD'),
      medium: getRowValue($collapseTwo, 'MEDIUM'),
      year_passing: getRowValue($collapseTwo, 'YEAR OF PASSING')
    };
  }

  // Family Info
  const $collapseThree = $('#collapseThree');
  if ($collapseThree.length) {
    let currentSection: 'father' | 'mother' = 'father';
    $collapseThree.find('tr').each((_, row) => {
      const text = $(row).text().trim().toUpperCase();
      if (text.includes('FATHER DETAILS')) {
        currentSection = 'father';
        return;
      } else if (text.includes('MOTHER DETAILS')) {
        currentSection = 'mother';
        return;
      }

      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toUpperCase();
        const val = $(cells[1]).text().trim();
        const target = profileData.family[currentSection];

        if (key.includes('NAME') && !key.includes('STREET') && !key.includes('AREA')) {
          target.name = val;
        } else if (key.includes('OCCUPATION')) {
          target.occupation = val;
        } else if (key.includes('ORGANIZATION')) {
          target.organization = val;
        } else if (key.includes('MOBILE')) {
          target.mobile = val;
        } else if (key.includes('EMAIL')) {
          target.email = val;
        }
      }
    });
  }

  // Proctor Info
  const $collapseFour = $('#collapseFour');
  if ($collapseFour.length) {
    profileData.proctor = {
      name: getRowValue($collapseFour, 'FACULTY NAME'),
      designation: getRowValue($collapseFour, 'FACULTY DESIGNATION'),
      cabin: getRowValue($collapseFour, 'CABIN'),
      email: getRowValue($collapseFour, 'FACULTY EMAIL'),
      mobile: getRowValue($collapseFour, 'FACULTY MOBILE NUMBER')
    };
  }

  // Hostel Info
  const $collapseFive = $('#collapseFive');
  if ($collapseFive.length) {
    profileData.hostel = {
      block: getRowValue($collapseFive, 'Block'),
      room: getRowValue($collapseFive, 'Room No'),
      bed_type: getRowValue($collapseFive, 'Bed Type'),
      mess: getRowValue($collapseFive, ' Mess Information')
    };
  }

  return profileData;
}

export function parseAttendanceSummary(htmlContent: string) {
  const $ = cheerio.load(htmlContent || '');
  const attendanceData: any[] = [];
  const table = $('#getStudentDetails table.table');

  if (!table.length) return [];

  const rows = table.find('tr');
  const onclickRegex = /processViewAttendanceDetail\('([^']*)','([^']*)'\);/;

  rows.each((i, row) => {
    if (i === 0) return; // skip header
    const cells = $(row).find('td');
    if (cells.length < 14) return;

    const facultyPs = $(cells[5]).find('p');
    const facultyArr: string[] = [];
    facultyPs.each((_, p) => {
      const text = $(p).text().trim();
      if (text) facultyArr.push(text);
    });
    const faculty = facultyArr.join(' ');

    const viewLink = $(cells[13]).find('a');
    let classId: string | null = null;
    let slotParam: string | null = null;

    if (viewLink.length && viewLink.attr('onclick')) {
      const match = onclickRegex.exec(viewLink.attr('onclick') || '');
      if (match) {
        classId = match[1];
        slotParam = match[2];
      }
    }

    attendanceData.push({
      sl_no: $(cells[0]).text().trim(),
      course_code: $(cells[1]).text().trim(),
      course_title: $(cells[2]).text().trim(),
      course_type: $(cells[3]).text().trim(),
      slot: $(cells[4]).text().trim(),
      faculty,
      attended_classes: $(cells[9]).text().trim(),
      total_classes: $(cells[10]).text().trim(),
      percentage: $(cells[11]).text().trim(),
      class_id: classId,
      slot_param: slotParam
    });
  });

  return attendanceData;
}

export function parseAttendanceDetail(htmlContent: string) {
  const $ = cheerio.load(htmlContent || '');
  const detailData: any[] = [];
  const table = $('#main-section table.table');

  if (!table.length) return [];

  const rows = table.find('tr');
  rows.each((i, row) => {
    if (i === 0) return; // skip header
    const cells = $(row).find('td');
    if (cells.length < 5) return;

    let statusText = 'Present';
    const statusSpan = $(cells[4]).find('span');
    if (statusSpan.length) {
      if ((statusSpan.attr('style') || '').includes('color:red;')) {
        statusText = 'Absent';
      } else {
        statusText = statusSpan.text().trim();
      }
    } else {
      statusText = $(cells[4]).text().trim();
    }

    detailData.push({
      sl_no: $(cells[0]).text().trim(),
      date: $(cells[1]).text().trim(),
      slot: $(cells[2]).text().trim(),
      timing: $(cells[3]).text().trim(),
      status: statusText
    });
  });

  return detailData;
}

export function parseCourseData(htmlContent: string) {
  if (!htmlContent) return { total_credits: '0.0', courses: [], timetable: {} };

  const $ = cheerio.load(htmlContent);
  const courseTable = $('#getStudentDetails div.table-responsive table.table');
  if (!courseTable.length) return { total_credits: '0.0', courses: [], timetable: {} };

  const headers = courseTable.find('th');
  const headerTexts: string[] = [];
  headers.each((_, h) => {
    headerTexts.push($(h).text().trim());
  });

  let courses: any[] = [];
  let totalCredits = '0.0';

  const rows = courseTable.find('tr');

  if (headerTexts.includes('Class Group')) {
    // Old format
    rows.each((i, row) => {
      if (i === 0 || i === rows.length - 1) return;
      const cells = $(row).find('td');
      if (cells.length < 8) return;

      courses.push({
        course_code: $(cells[1]).text().trim(),
        course_title: $(cells[2]).text().trim(),
        course_type: $(cells[3]).text().trim(),
        credits: $(cells[4]).text().trim(),
        faculty: $(cells[6]).text().trim(),
        slot: $(cells[5]).text().trim().replace(' -', ''),
        venue: 'N/A'
      });
    });
  } else {
    // New format
    rows.each((i, row) => {
      if (i === 0 || i === rows.length - 1) return;
      const cells = $(row).find('td');
      if (cells.length < 9) return;

      const courseInfoPs = $(cells[2]).find('p');
      if (!courseInfoPs.length) return;

      const codeTitle = $(courseInfoPs[0]).text().trim().split(' - ');
      if (codeTitle.length < 2) return;

      const courseTypeVal = courseInfoPs.length > 1 ? $(courseInfoPs[1]).text().trim() : 'Theory';
      const slotVenuePs = $(cells[7]).find('p');
      const slot = slotVenuePs.length > 0 ? $(slotVenuePs[0]).text().trim().replace(' -', '') : 'N/A';
      const venue = slotVenuePs.length > 1 ? $(slotVenuePs[1]).text().trim() : 'N/A';
      
      const facultyPs = $(cells[8]).find('p');
      const facultyArr: string[] = [];
      facultyPs.each((_, p) => {
        const text = $(p).text().trim();
        if (text) facultyArr.push(text);
      });

      courses.push({
        course_code: codeTitle[0],
        course_title: codeTitle[1],
        course_type: courseTypeVal.replace(/[()]/g, '').trim(),
        credits: $(cells[3]).text().trim().split(/\s+/).pop(),
        faculty: facultyArr.join(' ').replace(' - ', ' '),
        slot,
        venue
      });
    });
  }

  // Extract total credits
  rows.each((_, row) => {
    const text = $(row).text();
    if (text.includes('Total Number Of Credits')) {
      const bold = $(row).find('b');
      if (bold.length) {
        totalCredits = bold.text().trim();
      }
    }
  });

  const courseTitleMap = new Map<string, string>();
  courses.forEach(c => courseTitleMap.set(c.course_code, c.course_title));

  // Parse Grid
  const rawTimetableGrid = parseTimetableGrid($, courseTitleMap);
  const outputSlots = [
    '08:00 - 08:50', '08:55 - 09:45', '09:50 - 10:40', '10:45 - 11:35',
    '11:40 - 12:30', '12:35 - 13:25', 'LUNCH', '14:00 - 14:50',
    '14:55 - 15:45', '15:50 - 16:40', '16:45 - 17:35', '17:40 - 18:30',
    '18:35 - 19:25'
  ];

  const processedTimetable: Record<string, any> = {
    MON: {}, TUE: {}, WED: {}, THU: {}, FRI: {}, SAT: {}, SUN: {}
  };

  Object.keys(rawTimetableGrid).forEach(day => {
    const processedSlots = new Set<string>();
    outputSlots.forEach((slotKey, i) => {
      if (slotKey === 'LUNCH' || processedSlots.has(slotKey) || !rawTimetableGrid[day][slotKey]) {
        return;
      }

      const currentCourse = { ...rawTimetableGrid[day][slotKey] };
      let rowspan = 1;
      processedSlots.add(slotKey);

      for (let j = i + 1; j < outputSlots.length; j++) {
        const nextSlotKey = outputSlots[j];
        if (nextSlotKey === 'LUNCH') break;
        const nextSlotData = rawTimetableGrid[day][nextSlotKey];
        if (nextSlotData && nextSlotData.code === currentCourse.code) {
          rowspan++;
          processedSlots.add(nextSlotKey);
        } else {
          break;
        }
      }

      currentCourse.rowspan = rowspan;
      processedTimetable[day][slotKey] = currentCourse;
    });
  });

  return {
    total_credits: totalCredits,
    courses,
    timetable: processedTimetable
  };
}

function parseGridNewFormat($: cheerio.CheerioAPI, courseTitleMap: Map<string, string>): Record<string, any> {
  const rawData: Record<string, any> = {
    MON: {}, TUE: {}, WED: {}, THU: {}, FRI: {}, SAT: {}, SUN: {}
  };

  const tables = $('table#timeTableStyle');
  if (!tables.length) return rawData;

  const timeSlotKeys = [
    '08:00 - 08:50', '08:55 - 09:45', '09:50 - 10:40', '10:45 - 11:35',
    '11:40 - 12:30', '12:35 - 13:25', 'LUNCH', '14:00 - 14:50',
    '14:55 - 15:45', '15:50 - 16:40', '16:45 - 17:35', '17:40 - 18:30', '18:35 - 19:25'
  ];

  let scheduleTable = tables[0];

  $(scheduleTable).find('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    let currentDay = '';
    let dataCells: cheerio.Cheerio<any>;

    if (cells.eq(0).attr('rowspan')) {
      currentDay = cells.eq(0).text().trim();
      dataCells = cells.slice(2);
    } else if (['THEORY', 'LAB'].includes(cells.eq(0).text().trim())) {
      dataCells = cells.slice(1);
    } else {
      return;
    }

    if (!rawData[currentDay]) return;

    let colIdx = 0;
    dataCells.each((_, cell): any => {
      if (colIdx >= timeSlotKeys.length) return false; // break
      const colspan = parseInt($(cell).attr('colspan') || '1', 10);
      const text = $(cell).text().trim();

      if (text && text !== '-') {
        const parts = text.split('-');
        if (parts.length >= 4) {
          const courseCode = parts[1];
          const courseTypeShort = parts[2];
          const venue = parts.slice(3, -1).join('-');
          const classInfo = {
            code: courseCode,
            type: courseTypeShort,
            venue,
            title: courseTitleMap.get(courseCode) || courseCode
          };

          for (let i = 0; i < colspan; i++) {
            const slotIndex = colIdx + i;
            if (slotIndex < timeSlotKeys.length) {
              const slotKey = timeSlotKeys[slotIndex];
              if (slotKey !== 'LUNCH') {
                rawData[currentDay][slotKey] = classInfo;
              }
            }
          }
        }
      }
      colIdx += colspan;
    });
  });

  return rawData;
}

function parseGridOldFormat($: cheerio.CheerioAPI, courseTitleMap: Map<string, string>): Record<string, any> {
  const rawData: Record<string, any> = {
    MON: {}, TUE: {}, WED: {}, THU: {}, FRI: {}, SAT: {}, SUN: {}
  };
  const theorySlots = ["08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35", "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50", "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30", "18:35 - 19:25"];
  const labSlots = ["08:00 - 08:50", "08:50 - 09:40", "09:50 - 10:40", "10:40 - 11:30", "11:40 - 12:30", "12:30 - 13:20", "LUNCH", "14:00 - 14:50", "14:50 - 15:40", "15:50 - 16:40", "16:40 - 17:30", "17:40 - 18:30", "18:30 - 19:20"];
  const labSlotMap: Record<string, string> = { 
    "08:50 - 09:40": "08:55 - 09:45", 
    "10:40 - 11:30": "10:45 - 11:35", 
    "12:30 - 13:20": "12:35 - 13:25", 
    "14:50 - 15:40": "14:55 - 15:45", 
    "16:40 - 17:30": "16:45 - 17:35", 
    "18:30 - 19:20": "18:35 - 19:25" 
  };

  const tables = $('table#timeTableStyle');
  if (!tables.length) return rawData;

  let scheduleTable: any = null;
  tables.each((_, table): any => {
    const cells = $(table).find('td');
    cells.each((_, td): any => {
      const text = $(td).text().trim();
      if (text.includes('THEORY') && $(td).attr('rowspan') === '2') {
        scheduleTable = $(table);
        return false;
      }
      return true;
    });
    if (scheduleTable) return false;
    return true;
  });

  if (!scheduleTable) return rawData;

  const rows = $(scheduleTable).find('tr');
  let currentDay = '';

  rows.slice(2).each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    let rowType = '';
    let dataCells: cheerio.Cheerio<any>;

    const cell0 = cells.eq(0);
    if (cell0.attr('rowspan')) {
      currentDay = cell0.text().trim();
      const cell1 = cells.eq(1);
      if (!cell1.text().trim()) return;
      rowType = cell1.text().trim();
      dataCells = cells.slice(2);
    } else if (['THEORY', 'LAB'].includes(cell0.text().trim())) {
      rowType = cell0.text().trim();
      dataCells = cells.slice(1);
    } else {
      return;
    }

    if (!rawData[currentDay]) return;

    let slotKeys: string[] = [];
    let slotMap: Record<string, string> = {};

    if (rowType === 'THEORY') {
      slotKeys = theorySlots;
      slotMap = {};
    } else if (rowType === 'LAB') {
      slotKeys = labSlots;
      slotMap = labSlotMap;
    } else {
      return;
    }

    dataCells.each((i, cell): any => {
      if (i >= slotKeys.length) return false; // break
      const text = $(cell).text().trim();
      const slotKeyStd = slotMap[slotKeys[i]] || slotKeys[i];
      if (slotKeyStd === 'LUNCH') return;

      if (text && text !== '-' && !/^[A-Z]{1,3}\d{1,2}$/.test(text)) {
        const parts = text.split('-');
        if (parts.length > 2) {
          const courseCode = parts[1];
          const courseTypeShort = parts[2];
          const venue = parts.slice(3, -1).join('-');
          const classInfo = {
            code: courseCode,
            type: courseTypeShort,
            venue,
            title: courseTitleMap.get(courseCode) || courseCode
          };
          rawData[currentDay][slotKeyStd] = classInfo;
        }
      }
      return true;
    });
  });

  return rawData;
}

function parseTimetableGrid($: cheerio.CheerioAPI, courseTitleMap: Map<string, string>): Record<string, any> {
  const tables = $('table#timeTableStyle');
  if (!tables.length) {
    return {
      MON: {}, TUE: {}, WED: {}, THU: {}, FRI: {}, SAT: {}, SUN: {}
    };
  }

  const firstHeaderCell = $(tables[0]).find('td[bgcolor="#e2e2e2"]').first();
  if (firstHeaderCell.length && firstHeaderCell.text().includes(' - ')) {
    return parseGridNewFormat($, courseTitleMap);
  } else {
    return parseGridOldFormat($, courseTitleMap);
  }
}

export function parseAcademicCalendar(htmlContent: string) {
  if (!htmlContent) return { month_title: 'Calendar', days: [] };

  const $ = cheerio.load(htmlContent);
  const titleTag = $('h4');
  const monthTitle = titleTag.length ? titleTag.text().trim() : 'Calendar';

  const calendarData: any[] = [];
  let table = $('table.calendar-table');
  if (!table.length) table = $('table#calendar-table');
  if (!table.length) table = $('table').first();

  if (!table.length) {
    return { month_title: monthTitle, days: [] };
  }

  table.find('tr').each((_, row) => {
    if ($(row).text().includes('Sunday')) return; // skip header

    const cells = $(row).find('td');
    cells.each((colIdx, cell) => {
      let dayText = '';
      const spans = $(cell).find('span');
      let dayFound = false;
      const events: any[] = [];
      let allTextContent = '';

      spans.each((_, span) => {
        const text = $(span).text().trim();
        if (!text) return;

        if (!dayFound && /^\d+$/.test(text)) {
          dayText = text;
          dayFound = true;
          return;
        }

        if (!/^\d+$/.test(text)) {
          events.push({ text });
          allTextContent += ' ' + text.toLowerCase();
        }
      });

      if (dayText) {
        let status = 'general';
        if (allTextContent.includes('no instructional') || allTextContent.includes('holiday') || allTextContent.includes('vacation')) {
          status = 'holiday';
        } else if (allTextContent.includes('order')) {
          status = 'day_order';
        } else if (allTextContent.includes('instructional') || allTextContent.includes('working') || allTextContent.includes('fid')) {
          status = 'working';
        } else if (status === 'general' && (colIdx === 0 || colIdx === 6)) {
          if (!events.length) {
            status = 'holiday';
            events.push({ text: 'Holiday' });
          }
        }

        calendarData.push({
          day: parseInt(dayText, 10),
          status,
          events
        });
      } else {
        calendarData.push({ day: null, status: 'padding', events: [] });
      }
    });
  });

  return {
    month_title: monthTitle,
    days: calendarData
  };
}

export function parseMarks(htmlContent: string) {
  if (!htmlContent) return [];

  const $ = cheerio.load(htmlContent);
  const courses: any[] = [];

  const mainTable = $('table.customTable');
  if (!mainTable.length) return [];

  const rows = mainTable.find('> tr');
  let currentCourse: any = null;

  rows.each((_, row) => {
    if ($(row).hasClass('tableHeader')) return;

    const cells = $(row).find('> td');
    if (cells.length > 5 && !$(row).find('table').length) {
      if ($(cells[2]).text().trim() === 'Course Code') return;

      currentCourse = {
        class_nbr: $(cells[1]).text().trim(),
        code: $(cells[2]).text().trim(),
        title: $(cells[3]).text().trim(),
        type: $(cells[4]).text().trim(),
        faculty: $(cells[6]).text().trim(),
        slot: $(cells[7]).text().trim(),
        assessments: [],
        total_obtained: 0.0,
        total_max_weightage: 0.0
      };
      courses.push(currentCourse);
    } else if (currentCourse && $(row).find('table.customTable-level1').length) {
      const nestedTable = $(row).find('table.customTable-level1');
      const markRows = nestedTable.find('tr.tableContent-level1');

      markRows.each((_, mRow) => {
        const mCells = $(mRow).find('td');
        if (mCells.length < 7) return;

        const title = $(mCells[1]).text().trim();
        const maxMark = $(mCells[2]).text().trim();
        const weightagePct = $(mCells[3]).text().trim();
        const status = $(mCells[4]).text().trim();
        const scored = $(mCells[5]).text().trim();
        const weightageMark = $(mCells[6]).text().trim();

        const wMark = parseFloat(weightageMark);
        const wPct = parseFloat(weightagePct);

        if (!isNaN(wMark)) currentCourse.total_obtained += wMark;
        if (!isNaN(wPct)) currentCourse.total_max_weightage += wPct;

        currentCourse.assessments.push({
          title,
          max_mark: maxMark,
          weightage_pct: weightagePct,
          status,
          scored,
          weightage_mark: weightageMark
        });
      });

      currentCourse.total_obtained = Math.round(currentCourse.total_obtained * 100) / 100;
      currentCourse.total_max_weightage = Math.round(currentCourse.total_max_weightage * 100) / 100;
    }
  });

  return courses;
}

export function parseGrades(htmlContent: string) {
  const $ = cheerio.load(htmlContent || '');
  const data: { semesters: any[]; grades: any[]; gpa: string | null } = {
    semesters: [],
    grades: [],
    gpa: null
  };

  const semesterSelect = $('select#semesterSubId');
  if (semesterSelect.length) {
    semesterSelect.find('option').each((_, option) => {
      const val = $(option).attr('value');
      if (val) {
        data.semesters.push({
          id: val,
          name: $(option).text().trim(),
          selected: $(option).attr('selected') !== undefined
        });
      }
    });
  }

  const table = $('table.table-hover');
  if (table.length) {
    table.find('tr').each((_, row) => {
      const cols = $(row).find('td');

      if (cols.length >= 11) {
        // Find course details
        const trigger = $(row).find('[onclick*="getGradeViewDetails"]');
        let courseId = '';
        if (trigger.length) {
          const match = /getGradeViewDetails\(['"]?([^'\")]+)/.exec(trigger.attr('onclick') || '');
          if (match) courseId = match[1].trim();
        }

        data.grades.push({
          sl_no: $(cols[0]).text().trim(),
          code: $(cols[1]).text().trim(),
          title: $(cols[2]).text().trim(),
          type: $(cols[3]).text().trim(),
          l: $(cols[4]).text().trim(),
          p: $(cols[5]).text().trim(),
          j: $(cols[6]).text().trim(),
          credits: $(cols[7]).text().trim(),
          grading_type: $(cols[8]).text().trim(),
          total: $(cols[9]).text().trim(),
          grade: $(cols[10]).text().trim(),
          course_id: courseId,
          grade_statistics: null
        });
      } else if (cols.length === 1 && $(cols[0]).text().includes('GPA')) {
        const span = $(cols[0]).find('span');
        if (span.length) {
          const gpaText = span.text().trim();
          if (gpaText.includes(':')) {
            data.gpa = gpaText.split(':')[1].trim();
          }
        }
      }
    });
  }

  return data;
}

export function parseGradeStatistics(htmlContent: string) {
  const $ = cheerio.load(htmlContent || '');
  const GRADE_LABELS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

  let result = null;
  $('table').each((_, table) => {
    const tableText = $(table).text().replace(/\s+/g, ' ');
    if (!tableText.includes('Class Strength') || !tableText.includes('Range of Grades')) {
      return;
    }

    const rows: string[][] = [];
    $(table).find('> tr').each((_, tr) => {
      const cells = $(tr).find('> th, > td');
      const rowData: string[] = [];
      cells.each((_, cell) => {
        rowData.push($(cell).text().trim().replace(/\s+/g, ' '));
      });
      if (rowData.length) rows.push(rowData);
    });

    let gradeHeaderIndex: number | null = null;
    rows.forEach((row, index) => {
      if (GRADE_LABELS.every(label => row.includes(label))) {
        gradeHeaderIndex = index;
      }
    });

    if (gradeHeaderIndex === null) return;

    const valueRow = rows.slice(gradeHeaderIndex + 1).find(row => row.length >= 4);
    if (!valueRow) return;

    const stats = {
      class_strength: valueRow[0] || '',
      grading_strength: valueRow[1] || '',
      mean: valueRow[2] || '',
      sd: valueRow[3] || ''
    };

    const gradeValues = valueRow.slice(4, 4 + GRADE_LABELS.length);
    const ranges = GRADE_LABELS.map((grade, index) => ({
      grade,
      range: gradeValues[index] || ''
    }));

    let note = '';
    rows.slice(gradeHeaderIndex + 2).forEach(row => {
      const text = row.join(' ');
      if (text.toLowerCase().includes('policy')) {
        note = text;
      }
    });

    result = { stats, ranges, note };
    return false; // break loop
  });

  return result;
}

export function parseExamSchedule(htmlContent: string) {
  if (!htmlContent) return [];

  const $ = cheerio.load(htmlContent);
  const schedule: any[] = [];

  const table = $('table.customTable');
  if (!table.length) return [];

  const rows = table.find('tr');
  let currentExamType = 'Unknown Exam';

  rows.each((_, row) => {
    const headerCell = $(row).find('td.panelHead-secondary');
    if (headerCell.length) {
      currentExamType = headerCell.text().trim();
      return;
    }

    if ($(row).hasClass('tableHeader')) return;

    const cells = $(row).find('td');
    if (cells.length < 13) return;

    schedule.push({
      exam_type: currentExamType,
      course_code: $(cells[1]).text().trim(),
      course_title: $(cells[2]).text().trim(),
      course_type: $(cells[3]).text().trim(),
      slot: $(cells[5]).text().trim(),
      exam_date: $(cells[6]).text().trim(),
      exam_session: $(cells[7]).text().trim(),
      exam_time: $(cells[9]).text().trim(),
      venue: $(cells[10]).text().trim(),
      seat_location: $(cells[11]).text().trim(),
      seat_no: $(cells[12]).text().trim()
    });
  });

  return schedule;
}

export function parseCredentials(htmlContent: string) {
  if (!htmlContent) return { accounts: [], exams: [] };

  const $ = cheerio.load(htmlContent);
  const data: { accounts: any[]; exams: any[] } = { accounts: [], exams: [] };

  const table = $('table.customTable');
  if (!table.length) return data;

  const rows = table.find('tr.tableContent');
  rows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
      const account = $(cells[0]).text().trim();
      const username = $(cells[1]).text().trim();
      const password = $(cells[2]).text().trim();

      let url = '#';
      if (cells.length > 3) {
        const link = $(cells[3]).find('a');
        if (link.length) {
          url = link.attr('href') || '#';
        } else {
          const txt = $(cells[3]).text().trim();
          if (txt.startsWith('http')) url = txt;
        }
      }

      let venue_date = '-';
      let seat = '-';
      if (cells.length > 4) {
        venue_date = $(cells[4]).text().trim();
      }
      if (cells.length > 5) {
        seat = $(cells[5]).text().trim();
      }

      const entry = {
        account,
        username,
        password,
        url,
        venue_date,
        seat
      };

      if (venue_date && venue_date !== '-' && venue_date !== '') {
        data.exams.push(entry);
      } else {
        data.accounts.push(entry);
      }
    }
  });

  return data;
}
