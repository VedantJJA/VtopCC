import axios from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { sessionService } from './session.service';
import crypto from 'crypto';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';

// Helper to create a cookie-aware axios client per user
function createClient(jar: CookieJar) {
  return axios.create({
    baseURL: VTOP_BASE_URL,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36'
    },
    httpAgent: new HttpCookieAgent({ cookies: { jar }, keepAlive: true, keepAliveMsecs: 60000 }),
    httpsAgent: new HttpsCookieAgent({ cookies: { jar }, keepAlive: true, keepAliveMsecs: 60000 }),
    withCredentials: true,
    maxRedirects: 5 // Default redirect following for standard login/redirection flow
  });
}

export async function startLogin() {
  const jar = new CookieJar();
  const client = createClient(jar);

  // 1. GET open/page
  const openPageRes = await client.get('open/page');
  const csrfPreloginMatch = openPageRes.data.match(/name="_csrf"\s+value="([^"]+)"/) || openPageRes.data.match(/value="([^"]+)"\s+name="_csrf"/);
  const csrfPrelogin = csrfPreloginMatch ? csrfPreloginMatch[1] : (cheerio.load(openPageRes.data)('input[name="_csrf"]').val() as string);

  // 2. POST prelogin/setup
  const preloginPayload = new URLSearchParams();
  preloginPayload.append('_csrf', csrfPrelogin);
  preloginPayload.append('flag', 'VTOP');
  
  const preloginRes = await client.post('prelogin/setup', preloginPayload);
  const csrfLoginMatch = preloginRes.data.match(/name="_csrf"\s+value="([^"]+)"/) || preloginRes.data.match(/value="([^"]+)"\s+name="_csrf"/);
  const csrfLogin = csrfLoginMatch ? csrfLoginMatch[1] : (cheerio.load(preloginRes.data)('input[name="_csrf"]').val() as string);

  // 3. Get CAPTCHA
  const captchaRes = await client.get('get/new/captcha');
  const captchaSrcMatch = captchaRes.data.match(/img\s+src="([^"]+)"/);
  const captchaSrc = captchaSrcMatch ? captchaSrcMatch[1] : (cheerio.load(captchaRes.data)('img').attr('src') || '');

  // Save Jar in session
  const sessionId = crypto.randomUUID();
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
    sessionService.updateSession(sessionId, { username, authorizedId: authorizedId as string, csrfToken: undefined });
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