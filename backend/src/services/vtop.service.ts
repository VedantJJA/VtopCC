import axios from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';

const VTOP_BASE_URL = 'https://vtopcc.vit.ac.in/vtop/';

export const fetchLeaveHistory = async (client: any, csrfToken: string, regNo: string) => {
  // Step 1: Hit the menu endpoint to initialize the module
  const initPayload = new URLSearchParams({
    verifyMenu: 'true',
    authorizedID: regNo,
    _csrf: csrfToken,
    nocache: new Date().getTime().toString()
  });

  const initRes = await client.post('hostels/student/leave/1', initPayload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/content'
    }
  });

  // Extract the fresh CSRF token generated for the leave page
  const $ = cheerio.load(initRes.data);
  const leaveCsrf = $('input[name="_csrf"]').val() as string || csrfToken;

  // Step 2: Fetch the actual data
  const dataPayload = new URLSearchParams({
    _csrf: leaveCsrf,
    authorizedID: regNo,
    status: '',
    form: 'undefined',
    control: 'status',
    x: new Date().toUTCString()
  });

  const dataRes = await client.post('hostels/student/leave/4', dataPayload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'https://vtopcc.vit.ac.in/vtop/hostels/student/leave/1'
    }
  });

  // Pass the raw HTML to your existing parser
  return parseLeaves(dataRes.data);
};

// Serialized state that gets encrypted into the vtop_state JWT
export interface VtopState {
  jar: CookieJar.Serialized;  // CookieJar.serializeSync() output
  csrf?: string;              // Current CSRF token
  authorizedId?: string;
  username?: string;
}

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
    maxRedirects: 5
  });
}

// Deserialize a CookieJar from the stored state
export function deserializeJar(serialized: CookieJar.Serialized): CookieJar {
  return CookieJar.deserializeSync(serialized);
}

/**
 * Start a new login flow: fetch CSRF + CAPTCHA from VTOP.
 * Returns serialized jar state + captcha data (no server-side storage).
 */
export async function startLogin(): Promise<{
  state: VtopState;
  captchaType: number;
  captchaImageData: string;
}> {
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

  const state: VtopState = {
    jar: jar.serializeSync(),
    csrf: csrfLogin
  };

  return { state, captchaType: 1, captchaImageData: captchaSrc };
}

/**
 * Perform VTOP login using deserialized state.
 * Returns updated state on success (jar may have new cookies after login).
 */
export async function performVtopLogin(
  state: VtopState,
  username: string,
  password: string,
  captchaText: string,
  gResponse?: string
): Promise<{
  success: boolean;
  message?: string;
  code: string;
  updatedState?: VtopState;
  authorizedId?: string;
}> {
  const jar = deserializeJar(state.jar);
  const client = createClient(jar);
  const csrfToken = state.csrf!;

  const payload = new URLSearchParams();
  payload.append('_csrf', csrfToken);
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
    const authorizedId = ($('input[name="authorizedID"]').val() || $('input[id="authorizedIDX"]').val() || username) as string;
    const updatedState: VtopState = {
      jar: jar.serializeSync(),
      csrf: undefined, // Will be re-fetched on first data call
      authorizedId,
      username
    };
    return { success: true, authorizedId, code: 'success', updatedState };
  } else {
    // PARSE ERROR MESSAGES
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

/**
 * Get an authenticated Axios client + metadata from deserialized state.
 * Used by data controllers to make authenticated requests to VTOP.
 */
export async function getSessionDetails(state: VtopState): Promise<{
  client: ReturnType<typeof axios.create>;
  authorizedId: string;
  csrfToken: string;
  updatedState: VtopState;
}> {
  const jar = deserializeJar(state.jar);
  const client = createClient(jar);

  // Auto-detect expired session if login form HTML is returned
  client.interceptors.response.use(
    (response) => {
      if (typeof response.data === 'string' && response.data.includes('vtopLoginForm')) {
        return Promise.reject(new Error('Session expired or invalid.'));
      }
      return response;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Reuse CSRF token if already parsed
  if (state.csrf && state.authorizedId) {
    client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    client.defaults.headers.common['Referer'] = `${VTOP_BASE_URL}content`;
    return {
      client,
      authorizedId: state.authorizedId,
      csrfToken: state.csrf,
      updatedState: { ...state, jar: jar.serializeSync() }
    };
  }
  
  // Fetch content page to get CSRF token
  const contentRes = await client.get('content', {
    headers: { Referer: `${VTOP_BASE_URL}content` } 
  });

  const $ = cheerio.load(contentRes.data);
  if ($('#vtopLoginForm').length > 0) {
    throw new Error('Session expired or invalid.');
  }

  const csrfToken = $('input[name="_csrf"]').val() as string;

  // Return the customized client for data routes to use
  client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
  client.defaults.headers.common['Referer'] = `${VTOP_BASE_URL}content`;
  
  const updatedState: VtopState = {
    ...state,
    jar: jar.serializeSync(),
    csrf: csrfToken
  };

  return { client, authorizedId: state.authorizedId || '', csrfToken, updatedState };
}