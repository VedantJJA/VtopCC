import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import * as cheerio from 'cheerio';
import * as parsers from './parsers';
import { facultyDirectory } from '../data/facultyDirectory';
import { solveCaptchaClient } from '../lib/solver';
import { safeGetCache, safeStorageGet, safeStorageSet, safeStorageRemove } from '../lib/cache';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';

// In-memory session state for direct phone-to-VTOP connection
export interface DirectSession {
  authorizedId: string;
  csrfToken: string;
  username: string;
  cookies: Record<string, string>;
  lastVerified?: number;
}

let session: DirectSession = {
  authorizedId: '',
  csrfToken: '',
  username: '',
  cookies: {}
};

// Load saved session from storage engine if available
try {
  const saved = safeStorageGet('vtop_direct_session');
  if (saved) {
    session = JSON.parse(saved);
  }
} catch (_e) {}

function saveSession() {
  try {
    safeStorageSet('vtop_direct_session', JSON.stringify(session));
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
    safeStorageRemove('vtop_direct_session');
  } catch (_e) {}
}

// Cookie Helper: Robustly parse multiple Set-Cookie headers
function updateCookiesFromHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return;
  const reserved = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly', 'priority']);

  for (const [key, rawVal] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie' && rawVal) {
      const values = Array.isArray(rawVal) ? rawVal : [String(rawVal)];
      for (const value of values) {
        const tokens = value.split(';');
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i].trim();
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

  const typeMatch = setupHtml.match(/var\s+captchaType\s*=\s*(\d+)/i) || setupHtml.match(/captchaType\s*=\s*(\d+)/i);
  let captchaType = typeMatch ? parseInt(typeMatch[1], 10) : 1;

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

  const savedCreds = !!safeStorageGet('vtop_direct_saved_creds');

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
  session.lastVerified = Date.now();

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
    // LOGIN SUCCESSFUL
    const authorizedId = (
      $('input[name="authorizedID"]').val() ||
      $('input[id="authorizedIDX"]').val() ||
      $('input#authorizedID').val() ||
      username.trim().toUpperCase()
    ) as string;

    session.authorizedId = authorizedId;
    session.username = username.trim().toUpperCase();
    session.lastVerified = Date.now();

    const directCsrf = $('input[name="_csrf"]').val() as string;
    if (directCsrf) {
      session.csrfToken = directCsrf;
    }

    try {
      await refreshContentSession();
    } catch (e) {
      console.warn('[Direct VTOP] Content session refresh warning:', e);
    }

    saveSession();
    safeStorageSet('vtop_direct_saved_creds', JSON.stringify({ username: session.username, password: pass }));
    safeStorageSet('vtop_username', session.username);
    safeStorageRemove('vtop_explicit_logout');

    return { status: 'success', message: `Welcome, ${session.authorizedId}!` };
  } else {
    // LOGIN FAILED
    const errorRaw = $('span.text-danger strong').text().trim() ||
                     $('span.text-danger').text().trim() ||
                     $('[role="alert"]').text().trim();
    const errorText = errorRaw.toLowerCase();

    console.warn(`[Direct VTOP Login Failed] Error: "${errorRaw}"`);

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

export function isVtopHtmlSessionExpired(html: string | undefined | null): boolean {
  if (!html || typeof html !== 'string') return true;
  const trimmed = html.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length < 250 && !trimmed.includes('<table')) return true;
  return (
    html.includes('vtopLoginForm') ||
    html.includes('Session timeout') ||
    html.includes('Session Timeout') ||
    html.includes('Session Expired') ||
    html.includes('session expired') ||
    html.includes('Please Login') ||
    html.includes('please login') ||
    html.includes('Invalid Request') ||
    html.includes('Not Authorized') ||
    html.includes('open/page') ||
    (html.includes('<script>') && html.includes('location'))
  );
}

export async function directCheckSession(): Promise<{ status: 'success' | 'failure'; username?: string }> {
  if (!session.authorizedId || !session.csrfToken) {
    return { status: 'failure' };
  }

  // If verified within last 3 minutes and valid cookies exist, treat as valid to save roundtrips
  if (session.lastVerified && (Date.now() - session.lastVerified) < 3 * 60 * 1000 && Object.keys(session.cookies || {}).length > 0) {
    return { status: 'success', username: session.username || session.authorizedId };
  }

  try {
    const res = await vtopRequest({
      url: 'content',
      method: 'GET',
      headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/content' }
    });

    const html = typeof res.data === 'string' ? res.data : '';
    if (isVtopHtmlSessionExpired(html) || html.length < 500) {
      return { status: 'failure' };
    }

    const $ = cheerio.load(html);
    const csrf = $('input[name="_csrf"]').val() as string;
    if (csrf) session.csrfToken = csrf;
    session.lastVerified = Date.now();
    saveSession();

    return { status: 'success', username: session.username || session.authorizedId };
  } catch (_e) {
    return { status: 'failure' };
  }
}

// ---------------- SINGLE-FLIGHT AUTO SESSION RENEWER ----------------
let sessionRenewalPromise: Promise<boolean> | null = null;

export async function ensureDirectSession(forceRenew = false): Promise<boolean> {
  if (!forceRenew) {
    const check = await directCheckSession();
    if (check.status === 'success') {
      return true;
    }
  }

  if (sessionRenewalPromise) {
    return sessionRenewalPromise;
  }

  sessionRenewalPromise = (async () => {
    try {
      const savedStr = safeStorageGet('vtop_direct_saved_creds');
      if (!savedStr) {
        console.warn('[Direct Auth] No saved credentials available for auto session renew.');
        return false;
      }

      const saved = JSON.parse(savedStr);
      if (!saved.username || !saved.password) {
        return false;
      }

      console.log('[Direct Auth] Starting silent session auto-renewal...');
      const MAX_AUTO_RETRIES = 4;

      for (let attempt = 1; attempt <= MAX_AUTO_RETRIES; attempt++) {
        try {
          const startRes = await directStartLogin();
          if (startRes.status !== 'captcha_ready' || !startRes.captcha_image_data) {
            continue;
          }

          const solvedCaptcha = await solveCaptchaClient(startRes.captcha_image_data);
          if (!solvedCaptcha || solvedCaptcha.length !== 6) {
            continue;
          }

          const loginRes = await directLoginAttempt(
            saved.username,
            saved.password,
            solvedCaptcha
          );

          if (loginRes.status === 'success') {
            console.log(`[Direct Auth] Auto-renewal succeeded on attempt ${attempt}`);
            return true;
          }

          if (loginRes.status === 'invalid_credentials' || loginRes.status === 'error') {
            console.warn('[Direct Auth] Auto-renewal failed due to invalid creds or account lock.');
            return false;
          }

          // If invalid captcha, loop to retry
          console.log(`[Direct Auth] Captcha retry (${attempt}/${MAX_AUTO_RETRIES})...`);
        } catch (attemptErr: any) {
          console.warn(`[Direct Auth] Attempt ${attempt} failed:`, attemptErr.message);
        }
      }

      return false;
    } finally {
      sessionRenewalPromise = null;
    }
  })();

  return sessionRenewalPromise;
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
  if (isVtopHtmlSessionExpired(html)) {
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

  if (semesters.length === 0) {
    throw new Error('No semesters returned by VTOP');
  }

  return semesters;
}

export async function directGetTimetable(semesterSubId: string, isSaturday = true): Promise<any> {
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }

  if (!html.includes('<table') && !html.includes('course_code') && !html.includes('SLOT')) {
    throw new Error('VTOP returned invalid timetable markup or unauthenticated redirect.');
  }

  const parsedData = parsers.parseCourseData(html) as any;

  // Saturday day order patch
  if (isSaturday && parsedData && parsedData.timetable) {
    try {
      const now = new Date();
      const day = now.getDay();
      const daysToAdd = (6 - day + 7) % 7;
      const upcomingSat = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      const dd = String(upcomingSat.getDate()).padStart(2, '0');
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const mmm = months[upcomingSat.getMonth()];
      const yyyy = upcomingSat.getFullYear();
      const satDateStr = `${dd}-${mmm}-${yyyy}`;

      let selectedGroup = 'ALL';
      const groupMatch = /[A-Z0-9\+]+-[A-Z0-9]+-[A-Z]+-[A-Z0-9\.-]+-[A-Z0-9\.-]+-([A-Z0-9]+)/.exec(html);
      if (groupMatch) {
        selectedGroup = groupMatch[1];
      }

      const calRes = await vtopRequest({
        url: 'processViewCalendar',
        method: 'POST',
        data: {
          authorizedID: session.authorizedId,
          _csrf: session.csrfToken,
          calDate: satDateStr,
          semSubId: semesterSubId,
          classGroupId: selectedGroup,
          x: new Date().toUTCString()
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
        }
      });

      const calHtml = typeof calRes.data === 'string' ? calRes.data : '';
      const calData = parsers.parseAcademicCalendar(calHtml);

      let dayOrderCode: string | null = null;
      const satDayNum = upcomingSat.getDate();
      const satDayObj = (calData?.days || []).find((d: any) => d.day === satDayNum);
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

      if (dayOrderCode && parsedData.timetable[dayOrderCode]) {
        console.log(`[Direct VTOP] Mapping Saturday timetable to day order ${dayOrderCode}`);
        parsedData.timetable['SAT'] = parsedData.timetable[dayOrderCode] || {};
        parsedData.day_order_active = dayOrderCode;
      }
    } catch (_satErr) {
      // Non-fatal fallback
    }
  }

  return parsedData;
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }

  if (!html.includes('<table') && !html.includes('processViewAttendanceDetail')) {
    throw new Error('VTOP returned invalid attendance markup or unauthenticated redirect.');
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }
  return parsers.parseAttendanceDetail(html);
}

export async function directGetODSnapshot(semesterSubId: string): Promise<{ total_od_count: number }> {
  const courses = await directGetAttendance(semesterSubId);
  let totalOd = 0;

  if (Array.isArray(courses)) {
    for (const course of courses) {
      if (!course.class_id || !course.slot_param) continue;
      const isLab = (course.course_type || '').toUpperCase().includes('LAB');

      try {
        const details = await directGetAttendanceDetail(semesterSubId, course.class_id, course.slot_param);
        if (Array.isArray(details)) {
          for (const d of details) {
            const statusLower = (d.status || '').toLowerCase();
            if (statusLower.includes('duty') || statusLower === 'on duty' || statusLower === 'onduty') {
              totalOd += isLab ? 2 : 1;
            }
          }
        }
      } catch (_err) {
        // Individual detail fetch warning ignored
      }
    }
  }

  return { total_od_count: totalOd };
}

export async function directGetMarks(semesterSubId: string): Promise<{ courses: any[]; combined_scores: any[] }> {
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }

  const parsedMarks = parsers.parseMarks(html) || [];

  // Fetch credits from registered courses in timetable to attach them
  let courses: any[] = [];
  try {
    const cachedTt = safeGetCache<any>(`vtop_cache_timetable_${semesterSubId}`);
    if (cachedTt) {
      courses = cachedTt?.courses || (Array.isArray(cachedTt) ? cachedTt : []);
    }
    if (!courses || courses.length === 0) {
      const ttRes = await vtopRequest({
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
      const ttHtml = typeof ttRes.data === 'string' ? ttRes.data : '';
      courses = parsers.parseCourseData(ttHtml).courses || [];
    }
  } catch (_e) {}

  const creditLookup = new Map<string, number>();
  courses.forEach((c: any) => {
    const key = `${c.course_code}_${(c.course_type || '').toLowerCase()}`;
    creditLookup.set(key, parseFloat(c.credits) || 0);
  });

  parsedMarks.forEach((course: any) => {
    const courseType = (course.type || '').toLowerCase();
    let credits = creditLookup.get(`${course.code}_${courseType}`);

    if (credits === undefined) {
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

    const hasCompletedFat = (c: any) => {
      return (c.assessments || []).some((a: any) => {
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

  return { courses: parsedMarks, combined_scores: combinedScores };
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }

  const parsedData = parsers.parseGrades(html);

  // Fetch stats for each grade row
  if (parsedData && Array.isArray(parsedData.grades)) {
    for (const item of parsedData.grades) {
      const courseId = item.course_id;
      if (courseId) {
        try {
          const statsRes = await vtopRequest({
            url: 'examinations/examGradeView/getGradeViewDetails',
            method: 'POST',
            data: {
              authorizedID: session.authorizedId,
              x: new Date().toUTCString(),
              semesterSubId: semesterSubId || '',
              courseId: courseId,
              _csrf: session.csrfToken
            },
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
            }
          });
          const statsHtml = typeof statsRes.data === 'string' ? statsRes.data : '';
          item.grade_statistics = parsers.parseGradeStatistics(statsHtml);
        } catch (_statErr) {}
      }
    }
  }

  return parsedData;
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }
  return parsers.parseCredentials(html);
}

export async function directGetClassGroupId(semesterSubId: string): Promise<string> {
  let selectedGroup = 'ALL';
  try {
    const cachedTt = safeGetCache<any>(`vtop_cache_timetable_${semesterSubId}`);
    if (cachedTt) {
      const cachedTtStr = JSON.stringify(cachedTt);
      const pattern = /[A-Z0-9\+]+-[A-Z0-9]+-[A-Z]+-[A-Z0-9\.-]+-[A-Z0-9\.-]+-([A-Z0-9]+)/;
      const match = pattern.exec(cachedTtStr);
      if (match) return match[1];
    }

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
    const pattern = /[A-Z0-9\+]+-[A-Z0-9]+-[A-Z]+-[A-Z0-9\.-]+-[A-Z0-9\.-]+-([A-Z0-9]+)/;
    const match = pattern.exec(html);
    if (match) {
      selectedGroup = match[1];
    }
  } catch (_e) {
    selectedGroup = 'ALL';
  }
  return selectedGroup;
}

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

export async function directGetCalendar(semesterSubId: string, calDate: string): Promise<any> {
  let dateStr = calDate;
  if (!dateStr) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const now = new Date();
    dateStr = `01-${months[now.getMonth()]}-${now.getFullYear()}`;
  }

  const classGroupId = (await directGetClassGroupId(semesterSubId)) || 'ALL';
  const res = await vtopRequest({
    url: 'processViewCalendar',
    method: 'POST',
    data: {
      authorizedID: session.authorizedId,
      _csrf: session.csrfToken,
      calDate: dateStr,
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }

  let parsedData = parsers.parseAcademicCalendar(html);
  let newSemesterId: string | undefined = undefined;

  // Fallback to other semesters if empty
  if (!hasMeaningfulEvents(parsedData)) {
    try {
      const allSemesters = await directGetSemesters();
      for (const sem of allSemesters) {
        if (sem.id === semesterSubId) continue;
        const candidateGroup = (await directGetClassGroupId(sem.id)) || 'ALL';
        const retryRes = await vtopRequest({
          url: 'processViewCalendar',
          method: 'POST',
          data: {
            authorizedID: session.authorizedId,
            _csrf: session.csrfToken,
            calDate: dateStr,
            semSubId: sem.id,
            classGroupId: candidateGroup,
            x: new Date().toUTCString()
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
          }
        });
        const retryHtml = typeof retryRes.data === 'string' ? retryRes.data : '';
        const retryData = parsers.parseAcademicCalendar(retryHtml);
        if (hasMeaningfulEvents(retryData)) {
          parsedData = retryData;
          newSemesterId = sem.id;
          break;
        }
      }
    } catch (_e) {}
  }

  // Merge Exams for the month
  try {
    const monthsMap: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };
    const dateParts = dateStr.split('-');
    const viewMonth = monthsMap[dateParts[1].toUpperCase()];
    const viewYear = parseInt(dateParts[2], 10);

    const examsList = await directGetExams(semesterSubId);
    if (Array.isArray(examsList)) {
      for (const exam of examsList) {
        try {
          const exParts = exam.exam_date.split('-');
          const exDay = parseInt(exParts[0], 10);
          const exMonth = monthsMap[exParts[1].toUpperCase()];
          const exYear = parseInt(exParts[2], 10);

          if (exMonth === viewMonth && exYear === viewYear && parsedData?.days) {
            for (const dayObj of parsedData.days) {
              if (dayObj.day === exDay) {
                dayObj.status = 'exam';
                if (!Array.isArray(dayObj.events)) dayObj.events = [];
                const eventText = `${exam.exam_type || 'Exam'}: ${exam.course_code} (${exam.slot})`;
                if (!dayObj.events.some((e: any) => e.text === eventText)) {
                  dayObj.events.push({ text: eventText });
                }
              }
            }
          }
        } catch (_exErr) {}
      }
    }
  } catch (_mErr) {}

  return { ...parsedData, new_semester_id: newSemesterId };
}

export async function directSearchFaculty(empIdOrName: string): Promise<any> {
  let resolvedId = (empIdOrName || '').trim();

  // If not purely numeric, resolve from bundled faculty directory
  if (!/^\d+$/.test(resolvedId)) {
    const searchLower = resolvedId.toLowerCase();
    for (const [name, id] of Object.entries(facultyDirectory)) {
      if (name.toLowerCase() === searchLower) {
        resolvedId = String(id);
        break;
      }
    }
    if (!/^\d+$/.test(resolvedId)) {
      for (const [name, id] of Object.entries(facultyDirectory)) {
        if (name.toLowerCase().includes(searchLower)) {
          resolvedId = String(id);
          break;
        }
      }
    }
  }

  if (!/^\d+$/.test(resolvedId)) {
    throw new Error(`Could not resolve "${empIdOrName}" to an Employee ID. Please select from directory suggestions.`);
  }

  // Find known name from bundled directory if available
  let matchedDirectoryName = '';
  for (const [name, id] of Object.entries(facultyDirectory)) {
    if (String(id) === resolvedId) {
      matchedDirectoryName = name;
      break;
    }
  }

  // If device is offline, immediately return clean directory profile without network hanging
  if (typeof navigator !== 'undefined' && !navigator.onLine && matchedDirectoryName) {
    return {
      name: matchedDirectoryName,
      empId: resolvedId,
      designation: 'Faculty Member',
      department: 'VIT Chennai',
      school: 'VIT Chennai',
      email: `${resolvedId}@vit.ac.in`,
      cabin: 'Connect to VTOP for cabin',
      image: null,
      isOfflineRecord: true
    };
  }

  try {
    await ensureDirectSession();

    // 1. Initialize EmployeeSearch menu in VTOP session to ensure authorized context
    try {
      await vtopRequest({
        url: 'hrms/EmployeeSearchForStudent',
        method: 'POST',
        data: {
          verifyMenu: 'true',
          authorizedID: session.authorizedId,
          _csrf: session.csrfToken,
          nocache: Date.now().toString()
        },
        headers: {
          'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
        }
      });
    } catch (_menuErr) {}

    // 2. Query EmployeeSearch1ForStudent
    const res = await vtopRequest({
      url: 'hrms/EmployeeSearch1ForStudent',
      method: 'POST',
      data: {
        _csrf: session.csrfToken,
        authorizedID: session.authorizedId,
        empId: resolvedId,
        x: new Date().toUTCString()
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://vtopcc.vit.ac.in/vtop/hrms/EmployeeSearchForStudent'
      }
    });

    const html = typeof res.data === 'string' ? res.data : '';
    if (html.includes('vtopLoginForm')) {
      throw new Error('Session expired or invalid.');
    }

    const parsed = parsers.parseFacultyDetails(html);
    if (parsed && parsed.name) {
      return {
        ...parsed,
        empId: resolvedId,
        email: parsed.email || `${resolvedId}@vit.ac.in`
      };
    }
  } catch (err) {
    console.warn(`[directSearchFaculty] HRMS live fetch error for ${resolvedId}:`, err);
  }

  // Fallback to directory info so user is never left with an empty or broken screen
  if (matchedDirectoryName) {
    return {
      name: matchedDirectoryName,
      empId: resolvedId,
      designation: 'Faculty Member',
      department: 'VIT Chennai',
      school: 'VIT Chennai',
      email: `${resolvedId}@vit.ac.in`,
      cabin: 'Connect to VTOP for cabin',
      image: null,
      isOfflineRecord: true
    };
  }

  throw new Error('Faculty details not found on HRMS portal.');
}

export function directGetFacultyDirectory(): Record<string, string> {
  return facultyDirectory;
}

export async function directGetLeaveStatus(): Promise<any[]> {
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
    url: 'hostels/student/leave/4',
    method: 'POST',
    data: {
      _csrf: leaveCsrf,
      authorizedID: session.authorizedId,
      status: '',
      form: 'undefined',
      control: 'status',
      x: new Date().toUTCString()
    },
    headers: { 'Referer': 'https://vtopcc.vit.ac.in/vtop/hostels/student/leave/1' }
  });

  const html = typeof res.data === 'string' ? res.data : '';
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }
  return parsers.parseLeaves(html);
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
  if (isVtopHtmlSessionExpired(html)) {
    throw new Error('Session expired or invalid.');
  }
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
