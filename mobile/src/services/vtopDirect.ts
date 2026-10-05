import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import * as cheerio from 'cheerio';
import * as parsers from './parsers';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';

// In-memory session state for direct phone-to-VTOP connection
interface DirectSession {
  authorizedId: string;
  csrfToken: string;
  username: string;
  cookies: Record<string, string>;
}

let session: DirectSession = {
  authorizedId: '',
  csrfToken: '',
  username: '',
  cookies: {}
};

// Load saved session from localStorage if available
try {
  const saved = localStorage.getItem('vtop_direct_session');
  if (saved) {
    session = JSON.parse(saved);
  }
} catch (_e) {}

function saveSession() {
  try {
    localStorage.setItem('vtop_direct_session', JSON.stringify(session));
  } catch (_e) {}
}

export function clearDirectSession() {
  session = {
    authorizedId: '',
    csrfToken: '',
    username: '',
    cookies: {}
  };
  try {
    localStorage.removeItem('vtop_direct_session');
  } catch (_e) {}
}

// Cookie Helper: Robustly parse multiple Set-Cookie headers (often joined with commas)
function updateCookiesFromHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return;
  const reserved = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly', 'priority']);

  for (const [key, rawVal] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie' && rawVal) {
      const values = Array.isArray(rawVal) ? rawVal : [String(rawVal)];
      for (const value of values) {
        // Tokens separated by semicolons
        const tokens = value.split(';');
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i].trim();
          // If token has a comma, it separates an attribute of previous cookie and name=val of next
          if (token.includes(',')) {
            const parts = token.split(',');
            token = parts[parts.length - 1].trim();
          }
          const eqIdx = token.indexOf('=');
          if (eqIdx > 0) {
            const k = token.substring(0, eqIdx).trim();
            const v = token.substring(eqIdx + 1).trim();
            if (!reserved.has(k.toLowerCase()) && !/^\d{2}/.test(k)) {
              session.cookies[k] = v;
            }
          }
        }
      }
    }
  }
  saveSession();
}

function getCookieHeader(): string {
  return Object.entries(session.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// Direct HTTP Request Helper via CapacitorHttp
async function vtopRequest(options: {
  url: string;
  method?: 'GET' | 'POST';
  data?: Record<string, string> | string;
  headers?: Record<string, string>;
}): Promise<HttpResponse> {
  const method = options.method || 'GET';
  const fullUrl = options.url.startsWith('http') ? options.url : `${VTOP_BASE_URL}${options.url.replace(/^\//, '')}`;
  
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Origin': 'https://vtopcc.vit.ac.in',
    ...options.headers
  };

  const cookieStr = getCookieHeader();
  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }

  let res: HttpResponse;
  if (method === 'GET') {
    res = await CapacitorHttp.get({
      url: fullUrl,
      headers,
      connectTimeout: 20000,
      readTimeout: 20000
    });
  } else {
    // Form-encoded data
    let bodyData: any = options.data;
    if (typeof options.data === 'object' && !(options.data instanceof URLSearchParams)) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.data)) {
        params.append(k, v);
      }
      bodyData = params.toString();
      headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
    }

    res = await CapacitorHttp.post({
      url: fullUrl,
      data: bodyData,
      headers,
      connectTimeout: 20000,
      readTimeout: 20000
    });
  }

  updateCookiesFromHeaders(res.headers);
  return res;
}

// ---------------- DIRECT VTOP AUTHENTICATION ----------------

export async function directStartLogin(): Promise<{
  status: 'captcha_ready';
  captcha_type: number;
  captcha_image_data: string;
  has_saved_creds: boolean;
}> {
  console.log('[Direct VTOP] Step 1: GET open/page from phone IP...');
  const openRes = await vtopRequest({ url: 'open/page' });
  const openHtml = typeof openRes.data === 'string' ? openRes.data : '';

  const csrfMatch = openHtml.match(/name="_csrf"\s+value="([^"]+)"/) || openHtml.match(/value="([^"]+)"\s+name="_csrf"/);
  const preloginCsrf = csrfMatch ? csrfMatch[1] : (cheerio.load(openHtml)('input[name="_csrf"]').val() as string);

  if (!preloginCsrf) {
    throw new Error('Failed to retrieve CSRF token from VTOP open/page');
  }

  console.log('[Direct VTOP] Step 2: POST prelogin/setup...');
  const setupRes = await vtopRequest({
    url: 'prelogin/setup',
    method: 'POST',
    data: { _csrf: preloginCsrf, flag: 'VTOP' },
    headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/open/page' }
  });
  const setupHtml = typeof setupRes.data === 'string' ? setupRes.data : '';

  const loginCsrfMatch = setupHtml.match(/name="_csrf"\s+value="([^"]+)"/) || setupHtml.match(/value="([^"]+)"\s+name="_csrf"/);
  session.csrfToken = loginCsrfMatch ? loginCsrfMatch[1] : (cheerio.load(setupHtml)('input[name="_csrf"]').val() as string || preloginCsrf);

  // Parse captcha type
  const typeMatch = setupHtml.match(/var\s+captchaType\s*=\s*(\d+)/i) || setupHtml.match(/captchaType\s*=\s*(\d+)/i);
  let captchaType = typeMatch ? parseInt(typeMatch[1], 10) : 1;

  // Extract CAPTCHA Image
  const $setup = cheerio.load(setupHtml);
  let captchaImageData = $setup('#captchaBlock img').attr('src') || $setup('img[src^="data:image"]').attr('src') || '';
  if (!captchaImageData) {
    const m = setupHtml.match(/src="(data:image\/[^"]+)"/);
    if (m) captchaImageData = m[1];
  }

  // Fallback if missing: call get/new/captcha
  if (!captchaImageData) {
    console.log('[Direct VTOP] Captcha missing in setup HTML, calling get/new/captcha...');
    try {
      const capRes = await vtopRequest({ url: 'get/new/captcha' });
      const capHtml = typeof capRes.data === 'string' ? capRes.data : '';
      const $cap = cheerio.load(capHtml);
      captchaImageData = $cap('#captchaBlock img').attr('src') || $cap('img[src^="data:image"]').attr('src') || $cap('img').attr('src') || '';
      if (captchaImageData) {
        captchaType = 1;
      }
    } catch (_err) {}
  }

  saveSession();

  const savedCreds = !!localStorage.getItem('vtop_direct_saved_creds');

  return {
    status: 'captcha_ready',
    captcha_type: captchaType,
    captcha_image_data: captchaImageData,
    has_saved_creds: savedCreds
  };
}

export async function refreshContentSession(): Promise<string> {
  const contentRes = await vtopRequest({
    url: 'content',
    method: 'GET',
    headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/content' }
  });

  const html = typeof contentRes.data === 'string' ? contentRes.data : '';
  const $ = cheerio.load(html);
  if ($('#vtopLoginForm').length > 0) {
    throw new Error('Session expired or invalid.');
  }

  const freshCsrf = $('input[name="_csrf"]').val() as string;
  if (freshCsrf) {
    session.csrfToken = freshCsrf;
  }
  const authId = ($('input[name="authorizedID"]').val() || $('input#authorizedID').val()) as string;
  if (authId) {
    session.authorizedId = authId;
  }

  saveSession();
  return session.csrfToken;
}

export async function directLoginAttempt(
  username: string, 
  pass: string, 
  captchaText: string,
  gResponse?: string
): Promise<{ status: 'success' | 'invalid_credentials' | 'invalid_captcha' | 'error'; message?: string }> {
  console.log('[Direct VTOP] Submitting login from phone IP...');
  
  const payload: Record<string, string> = {
    _csrf: session.csrfToken,
    username: username.trim().toUpperCase(),
    password: pass
  };

  if (gResponse) {
    payload.gResponse = gResponse;
  } else {
    payload.captchaStr = captchaText;
  }

  const loginRes = await vtopRequest({
    url: 'login',
    method: 'POST',
    data: payload,
    headers: { 
      'Referer': 'https://vtopcc.vit.ac.in/vtop/prelogin/setup',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const html = typeof loginRes.data === 'string' ? loginRes.data : '';
  const $ = cheerio.load(html);
  const loginForm = $('#vtopLoginForm');

  if (loginForm.length === 0) {
    // LOGIN SUCCESSFUL!
    const authorizedId = (
      $('input[name="authorizedID"]').val() ||
      $('input[id="authorizedIDX"]').val() ||
      $('input#authorizedID').val() ||
      username.trim().toUpperCase()
    ) as string;

    session.authorizedId = authorizedId;
    session.username = username.trim().toUpperCase();

    // Check if csrf is already in the returned page
    const directCsrf = $('input[name="_csrf"]').val() as string;
    if (directCsrf) {
      session.csrfToken = directCsrf;
    }

    // Refresh content page to guarantee full session state & tokens
    try {
      await refreshContentSession();
    } catch (e) {
      console.warn('[Direct VTOP] Content session refresh warning:', e);
    }

    saveSession();
    localStorage.setItem('vtop_direct_saved_creds', JSON.stringify({ username: session.username, password: pass }));

    return { status: 'success', message: `Welcome, ${session.authorizedId}!` };
  } else {
    // LOGIN FAILED
    const errorRaw = $('span.text-danger strong').text().trim() ||
                     $('span.text-danger').text().trim() ||
                     $('[role="alert"]').text().trim();
    const errorText = errorRaw.toLowerCase();

    console.warn(`[Direct VTOP Login Failed] Error message: "${errorRaw}"`);

    let statusCode: 'invalid_credentials' | 'invalid_captcha' | 'error' = 'invalid_credentials';
    let errorMessage = 'Invalid LoginId or Password';

    if (errorText.includes('captcha')) {
      statusCode = 'invalid_captcha';
      errorMessage = 'Invalid Captcha';
    } else if (errorText.includes('locked') || errorText.includes('blocked') || errorText.includes('maximum fail')) {
      statusCode = 'error';
      errorMessage = 'Account locked due to multiple failed attempts.';
    } else if (errorRaw) {
      errorMessage = errorRaw;
    }

    return { status: statusCode, message: errorMessage };
  }
}

export async function directCheckSession(): Promise<{ status: 'success' | 'failure'; username?: string }> {
  if (!session.authorizedId) {
    return { status: 'failure' };
  }

  try {
    const res = await vtopRequest({
      url: 'content',
      method: 'GET',
      headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/content' }
    });

    const html = typeof res.data === 'string' ? res.data : '';
    if (html.includes('vtopLoginForm') || html.length < 500) {
      return { status: 'failure' };
    }

    const $ = cheerio.load(html);
    const csrf = $('input[name="_csrf"]').val() as string;
    if (csrf) session.csrfToken = csrf;

    return { status: 'success', username: session.username || session.authorizedId };
  } catch (_e) {
    return { status: 'failure' };
  }
}

// ---------------- DIRECT DATA FETCHERS ----------------

export async function directGetSemesters(): Promise<any[]> {
  const res = await vtopRequest({
    url: 'academics/common/StudentTimeTableChn',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      verifyMenu: 'true'
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  if (html.includes('vtopLoginForm')) {
    throw new Error('Session expired or invalid.');
  }

  const $ = cheerio.load(html);
  const semesters: any[] = [];
  $('select#semesterSubId option').each((_, opt) => {
    const val = $(opt).attr('value');
    if (val) {
      semesters.push({ id: val, name: $(opt).text().trim() });
    }
  });

  return semesters;
}

export async function directGetTimetable(semesterSubId: string): Promise<any> {
  const res = await vtopRequest({
    url: 'processViewTimeTable',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      semesterSubId: semesterSubId
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  if (html.includes('vtopLoginForm')) {
    throw new Error('Session expired or invalid.');
  }
  return parsers.parseCourseData(html);
}

export async function directGetAttendance(semesterSubId: string): Promise<any> {
  const res = await vtopRequest({
    url: 'processViewStudentAttendance',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      semesterSubId: semesterSubId
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  if (html.includes('vtopLoginForm')) {
    throw new Error('Session expired or invalid.');
  }
  return parsers.parseAttendanceSummary(html);
}

export async function directGetAttendanceDetail(semesterSubId: string, classId: string, slotName: string): Promise<any> {
  const res = await vtopRequest({
    url: 'processViewAttendanceDetail',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      lSemesterSubId: semesterSubId,
      classId: classId,
      slotName: slotName
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseAttendanceDetail(html);
}

export async function directGetMarks(semesterSubId: string): Promise<any> {
  const res = await vtopRequest({
    url: 'examinations/doStudentMarkView',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      semesterSubId: semesterSubId
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseMarks(html);
}

export async function directGetGrades(semesterSubId: string): Promise<any> {
  const res = await vtopRequest({
    url: 'examinations/examGradeView/doStudentGradeView',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      semesterSubId: semesterSubId
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseGrades(html);
}

export async function directGetExams(semesterSubId: string): Promise<any> {
  const res = await vtopRequest({
    url: 'examinations/doSearchExamScheduleForStudent',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      semesterSubId: semesterSubId
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseExamSchedule(html);
}

export async function directGetProfile(): Promise<any> {
  const res = await vtopRequest({
    url: 'studentsRecord/StudentProfileAllView',
    method: 'POST',
    data: {
      verifyMenu: 'true',
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      nocache: `@(${Date.now()})`
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseProfile(html);
}

export async function directGetCredentials(): Promise<any> {
  const res = await vtopRequest({
    url: 'proctor/viewStudentCredentials',
    method: 'POST',
    data: {
      verifyMenu: 'true',
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      nocache: `@(${Date.now()})`
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseCredentials(html);
}

export async function directGetClassGroupId(semesterSubId: string): Promise<string> {
  try {
    const res = await vtopRequest({
      url: 'processViewTimeTable',
      method: 'POST',
      data: {
        authorizedID: session.authorizedId,
        _csrf: session.csrfToken,
        semesterSubId: semesterSubId
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    const html = typeof res.data === 'string' ? res.data : '';
    const $ = cheerio.load(html);
    const classGroupId = $('input[name="classGroupId"]').val() || $('select#classGroupId option:selected').val() || '';
    return String(classGroupId);
  } catch (_e) {
    return '';
  }
}

export async function directGetCalendar(semesterSubId: string, calDate: string): Promise<any> {
  const classGroupId = await directGetClassGroupId(semesterSubId);
  const res = await vtopRequest({
    url: 'processViewCalendar',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      calDate: calDate,
      semSubId: semesterSubId,
      classGroupId: classGroupId,
      x: new Date().toUTCString()
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseAcademicCalendar(html);
}

export async function directSearchFaculty(empId: string): Promise<any> {
  const res = await vtopRequest({
    url: 'hrms/EmployeeSearch1ForStudent',
    method: 'POST',
    data: {
      _csrf: session.csrfToken,
      authorizedID: session.authorizedId,
      empId: empId,
      x: new Date().toUTCString()
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseFacultyDetails(html);
}

export async function directGetLeaveHistory(): Promise<any[]> {
  const initPayload = {
    verifyMenu: 'true',
    authorizedID: session.authorizedId,
    _csrf: session.csrfToken,
    nocache: Date.now().toString()
  };

  const initRes = await vtopRequest({
    url: 'hostels/student/leave/1',
    method: 'POST',
    data: initPayload,
    headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/content' }
  });

  const $ = cheerio.load(typeof initRes.data === 'string' ? initRes.data : '');
  const leaveCsrf = $('input[name="_csrf"]').val() as string || session.csrfToken;

  const res = await vtopRequest({
    url: 'hostels/student/leave/6',
    method: 'POST',
    data: {
      _csrf: leaveCsrf,
      authorizedID: session.authorizedId,
      history: '',
      form: 'undefined',
      control: 'history',
      x: new Date().toUTCString()
    },
    headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/hostels/student/leave/1' }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  return parsers.parseLeaveHistory(html);
}

// Direct probe to test latency and firewall connectivity from phone IP
export async function directProbeVtop(): Promise<{
  status: 'success' | 'failed';
  latencyMs: number;
  httpStatus?: number;
  errorMessage?: string;
}> {
  const start = Date.now();
  try {
    const res = await vtopRequest({ url: 'open/page' });
    return {
      status: 'success',
      latencyMs: Date.now() - start,
      httpStatus: res.status
    };
  } catch (err: any) {
    return {
      status: 'failed',
      latencyMs: Date.now() - start,
      errorMessage: err.message || 'Connection failed'
    };
  }
}
