import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { sessionService } from './session.service';
import crypto from 'crypto';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';

// Helper to create a cookie-aware axios client per user
function createClient(jar: CookieJar) {
  return wrapper(axios.create({
    baseURL: VTOP_BASE_URL,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36'
    },
    jar,
    withCredentials: true,
    maxRedirects: 5 // Now safe because tough-cookie handles the redirects!
  }));
}

export async function startLogin() {
  const jar = new CookieJar();
  const client = createClient(jar);

  // 1. GET open/page
  const openPageRes = await client.get('open/page');
  let $ = cheerio.load(openPageRes.data);
  const csrfPrelogin = $('input[name="_csrf"]').val() as string;

  // 2. POST prelogin/setup
  const preloginPayload = new URLSearchParams();
  preloginPayload.append('_csrf', csrfPrelogin);
  preloginPayload.append('flag', 'VTOP');
  
  const preloginRes = await client.post('prelogin/setup', preloginPayload);
  $ = cheerio.load(preloginRes.data);
  const csrfLogin = $('input[name="_csrf"]').val() as string;

  // 3. Get CAPTCHA
  const captchaRes = await client.get('get/new/captcha');
  const captchaImg = cheerio.load(captchaRes.data)('img');
  const captchaSrc = captchaImg.attr('src') || '';

  // Save Jar in session
  const sessionId = crypto.randomUUID(); // Import crypto
  sessionService.sessions.set(sessionId, {
    cookieJar: jar,
    csrfToken: csrfLogin,
    lastAccessed: Date.now()
  });

  return { sessionId, captchaType: 1, captchaImageData: captchaSrc };
}

export async function performVtopLogin(sessionId: string, username: string, password: string, captchaText: string, gResponse?: string) {
  const session = sessionService.getSession(sessionId);
  if (!session) return { success: false, message: 'Session expired', code: 'session_expired' };

  const client = createClient(session.cookieJar);
  const payload = new URLSearchParams();
  payload.append('_csrf', session.csrfToken!);
  payload.append('username', username);
  payload.append('password', password);
  
  if (gResponse) {
    payload.append('gResponse', gResponse);
  } else {
    payload.append('captchaStr', captchaText);
  }

  const loginRes = await client.post('login', payload);
  const $ = cheerio.load(loginRes.data);
  const loginForm = $('#vtopLoginForm');

  if (loginForm.length === 0) {
    // SUCCESS
    let authorizedId = $('input[name="authorizedID"]').val() || $('input[id="authorizedIDX"]').val() || username;
    sessionService.updateSession(sessionId, { username, authorizedId: authorizedId as string });
    return { success: true, authorizedId, code: 'success' };
  } else {
    // PARSE ERROR MESSAGES LIKE THE FLASK APP
    let status_code = 'invalid_credentials';
    let error_message = 'Invalid credentials.';
    
    const errorText = $('span.text-danger strong').text().toLowerCase();
    if (errorText) {
      if (errorText.includes('captcha')) {
        status_code = 'invalid_captcha';
        error_message = 'Incorrect CAPTCHA.';
      } else if (errorText.includes('maximum fail')) {
        status_code = 'locked';
        error_message = 'Account locked due to multiple failed attempts.';
      }
    }
    return { success: false, message: error_message, code: status_code };
  }
}

export async function getSessionDetails(sessionId: string) {
  const session = sessionService.getSession(sessionId);
  if (!session) throw new Error('Session expired.');

  const client = createClient(session.cookieJar);

  // Auto-detect expired session if login form HTML is returned
  client.interceptors.response.use(
    (response) => {
      if (typeof response.data === 'string' && response.data.includes('vtopLoginForm')) {
        sessionService.deleteSession(sessionId);
        return Promise.reject(new Error('Session expired or invalid.'));
      }
      return response;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Optimize: Reuse CSRF token and authorized ID if already parsed
  if (session.csrfToken && session.authorizedId) {
    client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    client.defaults.headers.common['Referer'] = `${VTOP_BASE_URL}content`;
    return { client, authorizedId: session.authorizedId, csrfToken: session.csrfToken };
  }
  
  // FIX: Remove the slash in `${baseUrl}content`
  const contentRes = await client.get('content', {
    headers: { Referer: `${VTOP_BASE_URL}content` } 
  });

  const $ = cheerio.load(contentRes.data);
  if ($('#vtopLoginForm').length > 0) {
    sessionService.deleteSession(sessionId);
    throw new Error('Session expired or invalid.');
  }

  const csrfToken = $('input[name="_csrf"]').val() as string;
  sessionService.updateSession(sessionId, { csrfToken });

  // Return the customized client for data routes to use
  client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
  client.defaults.headers.common['Referer'] = `${VTOP_BASE_URL}content`;
  
  return { client, authorizedId: session.authorizedId || '', csrfToken };
}