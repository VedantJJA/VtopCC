import axios from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { parseLeaves } from './parsers.service';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';
export const VTOP_BASE_URL = process.env.VTOP_BASE_URL || 'https://vtopcc.vit.ac.in/vtop/';

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
export function createClient(jar: CookieJar) {
  return axios.create({
    baseURL: VTOP_BASE_URL,
    timeout: 15000, // Fail fast (15s) instead of hanging if datacenter IP is blocked
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    httpAgent: new HttpCookieAgent({ cookies: { jar }, keepAlive: true, keepAliveMsecs: 60000 }),
    httpsAgent: new HttpsCookieAgent({ 
      cookies: { jar }, 
      keepAlive: true, 
      keepAliveMsecs: 60000,
      rejectUnauthorized: false
    }),
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
  debug?: Record<string, any>;
}> {
  const jar = new CookieJar();
  const client = createClient(jar);
  let currentStep = 'init';

  try {
    // 1. GET open/page
    currentStep = 'open/page';
    console.log(`[VTOP] Step 1: GET open/page from ${VTOP_BASE_URL}...`);
    const openPageRes = await client.get('open/page');
    
    currentStep = 'extract_csrf';
    const csrfPreloginMatch = openPageRes.data.match(/name="_csrf"\s+value="([^"]+)"/) || openPageRes.data.match(/value="([^"]+)"\s+name="_csrf"/);
    const csrfPrelogin = csrfPreloginMatch ? csrfPreloginMatch[1] : (cheerio.load(openPageRes.data)('input[name="_csrf"]').val() as string);

    if (!csrfPrelogin) {
      throw new Error(`Failed to extract prelogin CSRF from open/page (Status ${openPageRes.status}, Body length ${openPageRes.data?.length || 0})`);
    }

    // 2. POST prelogin/setup
    currentStep = 'prelogin/setup';
    console.log(`[VTOP] Step 2: POST prelogin/setup...`);
    const preloginPayload = new URLSearchParams();
    preloginPayload.append('_csrf', csrfPrelogin);
    preloginPayload.append('flag', 'VTOP');
    
    const preloginRes = await client.post('prelogin/setup', preloginPayload);
    const csrfLoginMatch = preloginRes.data.match(/name="_csrf"\s+value="([^"]+)"/) || preloginRes.data.match(/value="([^"]+)"\s+name="_csrf"/);
    const csrfLogin = csrfLoginMatch ? csrfLoginMatch[1] : (cheerio.load(preloginRes.data)('input[name="_csrf"]').val() as string);

    // 3. Parse captchaType from HTML
    currentStep = 'parse_captcha';
    const captchaTypeMatch = preloginRes.data.match(/var\s+captchaType\s*=\s*(\d+)/i) || preloginRes.data.match(/captchaType\s*=\s*(\d+)/i);
    let captchaType = captchaTypeMatch ? parseInt(captchaTypeMatch[1], 10) : 1;

    // 4. Extract CAPTCHA image
    let captchaImageData = '';
    const $prelogin = cheerio.load(preloginRes.data);
    captchaImageData = $prelogin('#captchaBlock img').attr('src') || 
                       $prelogin('img[src^="data:image"]').attr('src') || '';

    if (!captchaImageData) {
      const match = preloginRes.data.match(/src="(data:image\/[^"]+)"/);
      if (match) captchaImageData = match[1];
    }

    // Fallback: If prelogin didn't contain the captcha image (e.g. if VTOP set captchaType=2/ReCAPTCHA),
    // always request get/new/captcha to fetch a real image captcha!
    if (!captchaImageData) {
      currentStep = 'get/new/captcha';
      console.log('[VTOP] Captcha image not found in prelogin; fetching get/new/captcha...');
      try {
        const captchaRes = await client.get('get/new/captcha');
        const $cap = cheerio.load(captchaRes.data);
        captchaImageData = $cap('#captchaBlock img').attr('src') || 
                           $cap('img[src^="data:image"]').attr('src') || 
                           $cap('img').attr('src') || '';
        if (!captchaImageData) {
          const match = captchaRes.data.match(/src="(data:image\/[^"]+)"/);
          if (match) captchaImageData = match[1];
        }

        if (captchaImageData) {
          console.log('[VTOP] Successfully retrieved image CAPTCHA from get/new/captcha!');
          captchaType = 1; // Mark as image captcha
        }
      } catch (err: any) {
        console.warn('[VTOP] Fallback get/new/captcha failed:', err?.message || err);
      }
    }

    const state: VtopState = {
      jar: jar.serializeSync(),
      csrf: csrfLogin
    };

    console.log(`[VTOP] Login flow ready: captchaType=${captchaType}, imgLength=${captchaImageData?.length || 0}`);

    return { 
      state, 
      captchaType, 
      captchaImageData,
      debug: {
        step: 'success',
        openPageStatus: openPageRes.status,
        preloginStatus: preloginRes.status,
        captchaTypeDetected: captchaType,
        hasImage: !!captchaImageData,
        imgLength: captchaImageData?.length || 0,
        vtopUrl: VTOP_BASE_URL
      }
    };
  } catch (err: any) {
    console.error(`[VTOP] startLogin failed at step "${currentStep}":`, err?.message || err);
    throw Object.assign(err, { 
      failedStep: currentStep,
      vtopUrl: VTOP_BASE_URL
    });
  }
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
    let error_message = 'Invalid LoginId/Password';
    
    const errorRaw = $('span.text-danger strong').text().trim() || $('span.text-danger').text().trim() || $('[role="alert"]').text().trim();
    const errorText = errorRaw.toLowerCase();
    
    console.log(`[VTOP Login Failed] Extracted error message: "${errorRaw}"`);

    if (errorText) {
      if (errorText.includes('captcha')) {
        status_code = 'invalid_captcha';
        error_message = 'Invalid Captcha';
      } else if (errorText.includes('maximum fail') || errorText.includes('locked') || errorText.includes('blocked')) {
        status_code = 'locked';
        error_message = 'Account locked due to multiple failed attempts.';
      } else if (errorText.includes('invalid loginid/password') || errorText.includes('invalid') || errorText.includes('password') || errorText.includes('user')) {
        status_code = 'invalid_credentials';
        error_message = 'Invalid LoginId/Password';
      } else {
        error_message = errorRaw;
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