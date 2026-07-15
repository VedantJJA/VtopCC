import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import { sessionService } from './session.service';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const httpClient = axios.create({
  baseURL: VTOP_BASE_URL,
  headers: HEADERS,
  httpsAgent,
  timeout: 20000
});

// Helper: parse set-cookie headers from VTOP response
export function parseCookies(cookieHeaders: string[] | undefined, existingCookies: Record<string, string> = {}) {
  if (!cookieHeaders) return existingCookies;
  const cookies = { ...existingCookies };
  cookieHeaders.forEach(header => {
    const parts = header.split(';')[0].split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookies[name] = value;
    }
  });
  return cookies;
}

// Helper: serialize cookies back to Cookie request header format
export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export async function startLogin() {
  try {
    let sessionCookies: Record<string, string> = {};

    // 1. GET open/page to extract prelogin CSRF token & cookies
    const openPageRes = await httpClient.get('open/page');
    sessionCookies = parseCookies(openPageRes.headers['set-cookie'], sessionCookies);
    
    let $ = cheerio.load(openPageRes.data);
    const csrfPrelogin = $('input[name="_csrf"]').val() as string;
    if (!csrfPrelogin) throw new Error('Prelogin CSRF token not found');

    // 2. POST prelogin/setup to set up VTOP login form
    const preloginPayload = new URLSearchParams();
    preloginPayload.append('_csrf', csrfPrelogin);
    preloginPayload.append('flag', 'VTOP');

    const preloginRes = await httpClient.post('prelogin/setup', preloginPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': serializeCookies(sessionCookies)
      }
    });
    sessionCookies = parseCookies(preloginRes.headers['set-cookie'], sessionCookies);

    const htmlText = preloginRes.data;
    $ = cheerio.load(htmlText);
    const csrfLogin = $('input[name="_csrf"]').val() as string;
    if (!csrfLogin) throw new Error('Login CSRF token not found');

    // Force built-in text CAPTCHA (matching Flask app behavior)
    // This avoids Google ReCAPTCHA localhost domain check issues
    const captchaType = 1; 
    let captchaSrc = '';

    try {
      const captchaRes = await httpClient.get('get/new/captcha', {
        headers: {
          'Cookie': serializeCookies(sessionCookies)
        }
      });
      sessionCookies = parseCookies(captchaRes.headers['set-cookie'], sessionCookies);

      const $captcha = cheerio.load(captchaRes.data);
      const captchaImg = $captcha('img');
      captchaSrc = captchaImg.attr('src') || '';
    } catch (err) {
      console.error('Failed to load VTOP built-in CAPTCHA image', err);
    }

    // Save in session manager
    const sessionId = sessionService.createSession(sessionCookies);
    sessionService.updateSession(sessionId, { csrfToken: csrfLogin });

    return {
      sessionId,
      captchaType,
      captchaImageData: captchaSrc
    };
  } catch (error: any) {
    console.error('Error starting login flow:', error);
    throw error;
  }
}

export async function performVtopLogin(
  sessionId: string,
  username: string,
  password: string,
  captchaText: string,
  gResponse?: string
) {
  const session = sessionService.getSession(sessionId);
  if (!session) {
    return { success: false, message: 'Session expired or invalid.', code: 'session_expired' };
  }

  const csrfToken = session.csrfToken;
  if (!csrfToken) {
    return { success: false, message: 'CSRF token missing in session.', code: 'csrf_missing' };
  }

  try {
    const payload = new URLSearchParams();
    payload.append('_csrf', csrfToken);
    payload.append('username', username);
    payload.append('password', password);
    
    if (gResponse) {
      payload.append('gResponse', gResponse);
    } else {
      payload.append('captchaStr', captchaText);
    }

    const loginRes = await httpClient.post('login', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': serializeCookies(session.cookies)
      }
    });

    // Update cookies from login response
    const updatedCookies = parseCookies(loginRes.headers['set-cookie'], session.cookies);
    sessionService.updateSession(sessionId, { cookies: updatedCookies });

    const $ = cheerio.load(loginRes.data);
    const loginForm = $('#vtopLoginForm');

    if (loginForm.length === 0) {
      // Login successful
      let authorizedId = username;
      const authIdInput = $('input[name="authorizedID"]');
      if (authIdInput.length && authIdInput.val()) {
        authorizedId = authIdInput.val() as string;
      } else {
        const authIdxInput = $('input[id="authorizedIDX"]');
        if (authIdxInput.length && authIdxInput.val()) {
          authorizedId = authIdxInput.val() as string;
        }
      }

      sessionService.updateSession(sessionId, {
        username,
        authorizedId
      });

      return { success: true, authorizedId, code: 'success' };
    } else {
      // Login failed
      let errorStr = 'Invalid credentials.';
      let code = 'invalid_credentials';

      const errorSpan = $('span.text-danger strong');
      if (errorSpan.length) {
        const text = errorSpan.text().trim().toLowerCase();
        errorStr = errorSpan.text().trim();
        if (text.includes('captcha')) {
          code = 'invalid_captcha';
          errorStr = 'Incorrect CAPTCHA.';
        } else if (text.includes('maximum fail')) {
          code = 'locked';
          errorStr = 'Account locked due to multiple failed attempts.';
        }
      }

      return { success: false, message: errorStr, code };
    }
  } catch (error: any) {
    console.error('Login attempt failed:', error);
    return { success: false, message: error.message || 'Network error during VTOP login.', code: 'error' };
  }
}

export async function getSessionDetails(sessionId: string) {
  const session = sessionService.getSession(sessionId);
  if (!session) {
    throw new Error('Session expired or invalid.');
  }

  const authId = session.authorizedId || session.username || '';
  const baseUrl = VTOP_BASE_URL;

  try {
    const contentRes = await httpClient.get('content', {
      headers: { 
        Referer: `${baseUrl}/content`,
        'Cookie': serializeCookies(session.cookies)
      }
    });

    const updatedCookies = parseCookies(contentRes.headers['set-cookie'], session.cookies);
    const $ = cheerio.load(contentRes.data);

    // If redirected to login or we don't have authorizedID/IDX in DOM, session is invalid/expired
    const hasAuthId = $('input[name="authorizedID"]').length > 0 || $('input[id="authorizedIDX"]').length > 0 || $('input[name="authorizedIDX"]').length > 0;
    if ($('#vtopLoginForm').length > 0 || !hasAuthId) {
      sessionService.deleteSession(sessionId);
      throw new Error('Session expired or invalid.');
    }

    const csrfToken = $('input[name="_csrf"]').val() as string;

    if (!csrfToken) {
      sessionService.deleteSession(sessionId);
      throw new Error('Session expired (CSRF missing).');
    }

    // Update csrfToken and cookies in session store
    sessionService.updateSession(sessionId, { csrfToken, cookies: updatedCookies });

    const client = axios.create({
      baseURL: VTOP_BASE_URL,
      headers: {
        ...HEADERS,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${VTOP_BASE_URL}content`,
        'Cookie': serializeCookies(updatedCookies)
      },
      httpsAgent,
      timeout: 20000
    });

    return {
      client,
      authorizedId: authId,
      csrfToken,
      baseUrl
    };
  } catch (error: any) {
    sessionService.deleteSession(sessionId);
    throw new Error(error.message || 'Session expired or network error.');
  }
}
