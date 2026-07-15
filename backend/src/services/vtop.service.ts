import axios from 'axios';
import * as cheerio from 'cheerio';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';
import { sessionService } from './session.service';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

// Helper to create a cookie-aware axios client per user session
export function createClient(jar: CookieJar) {
  const httpsAgent = new HttpsCookieAgent({
    cookies: { jar },
    rejectUnauthorized: false
  });

  return axios.create({
    baseURL: VTOP_BASE_URL,
    headers: HEADERS,
    httpsAgent,
    withCredentials: true,
    timeout: 20000,
    maxRedirects: 5
  });
}

export async function startLogin() {
  try {
    const sessionId = sessionService.createSession();
    const session = sessionService.getSession(sessionId)!;
    const client = createClient(session.cookieJar);

    // 1. GET open/page to extract prelogin CSRF token & cookies
    const openPageRes = await client.get('open/page');
    
    let $ = cheerio.load(openPageRes.data);
    const csrfPrelogin = $('input[name="_csrf"]').val() as string;
    if (!csrfPrelogin) throw new Error('Prelogin CSRF token not found');

    // 2. POST prelogin/setup to set up VTOP login form
    const preloginPayload = new URLSearchParams();
    preloginPayload.append('_csrf', csrfPrelogin);
    preloginPayload.append('flag', 'VTOP');

    const preloginRes = await client.post('prelogin/setup', preloginPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const htmlText = preloginRes.data;
    $ = cheerio.load(htmlText);
    const csrfLogin = $('input[name="_csrf"]').val() as string;
    if (!csrfLogin) throw new Error('Login CSRF token not found');

    // Force built-in text CAPTCHA
    const captchaType = 1; 
    let captchaSrc = '';

    try {
      const captchaRes = await client.get('get/new/captcha');
      const $captcha = cheerio.load(captchaRes.data);
      const captchaImg = $captcha('img');
      captchaSrc = captchaImg.attr('src') || '';
    } catch (err) {
      console.error('Failed to load VTOP built-in CAPTCHA image', err);
    }

    // Update in session manager
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
    const client = createClient(session.cookieJar);
    const payload = new URLSearchParams();
    payload.append('_csrf', csrfToken);
    payload.append('username', username);
    payload.append('password', password);
    
    if (gResponse) {
      payload.append('gResponse', gResponse);
    } else {
      payload.append('captchaStr', captchaText);
    }

    const loginRes = await client.post('login', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

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
    const client = createClient(session.cookieJar);

    const contentRes = await client.get('content', {
      headers: { 
        Referer: `${VTOP_BASE_URL}content`
      }
    });

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

    // Update csrfToken in session store
    sessionService.updateSession(sessionId, { csrfToken });

    // Set common headers for all data queries
    client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    client.defaults.headers.common['Referer'] = `${VTOP_BASE_URL}content`;

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

