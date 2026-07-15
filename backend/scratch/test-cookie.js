const axios = require('axios');
const https = require('https');

function parseCookies(cookieHeaders, existingCookies = {}) {
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

function serializeCookies(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function test() {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  const client = axios.create({
    baseURL: 'https://vtopcc.vit.ac.in/vtop/',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    },
    httpsAgent,
    timeout: 20000
  });

  let sessionCookies = {};

  console.log("1. Fetching open/page...");
  const res1 = await client.get('open/page');
  sessionCookies = parseCookies(res1.headers['set-cookie'], sessionCookies);
  console.log("Cookies after res1:", sessionCookies);

  console.log("2. Posting prelogin/setup...");
  try {
    const payload = new URLSearchParams();
    payload.append('_csrf', 'dummy-csrf-token'); // Let's try parsing csrf from res1 text first
    payload.append('flag', 'VTOP');

    // Parse actual CSRF from res1.data
    const cheerio = require('cheerio');
    const $ = cheerio.load(res1.data);
    const csrfVal = $('input[name="_csrf"]').val();
    console.log("Parsed CSRF for prelogin:", csrfVal);

    const payloadActual = new URLSearchParams();
    payloadActual.append('_csrf', csrfVal);
    payloadActual.append('flag', 'VTOP');

    const res2 = await client.post('prelogin/setup', payloadActual, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': serializeCookies(sessionCookies)
      }
    });
    sessionCookies = parseCookies(res2.headers['set-cookie'], sessionCookies);
    console.log("Res2 status:", res2.status);
    console.log("Cookies after res2:", sessionCookies);
    
    // Parse CSRF login from res2
    const $2 = cheerio.load(res2.data);
    const csrfLogin = $2('input[name="_csrf"]').val();
    console.log("Parsed CSRF for login:", csrfLogin);
    
    // Find captchaType in script
    const scripts = $2('script').map((i, el) => $2(el).html()).get().join('\n');
    const match = scripts.match(/captchaType\s*=\s*(\d+)/);
    const captchaType = match ? parseInt(match[1]) : null;
    console.log("Parsed captchaType:", captchaType);

    if (captchaType === 1) {
      console.log("3. Fetching built-in CAPTCHA image...");
      const res3 = await client.get('get/new/captcha', {
        headers: {
          'Cookie': serializeCookies(sessionCookies)
        }
      });
      console.log("Res3 status:", res3.status);
      const $3 = cheerio.load(res3.data);
      const captchaImg = $3('img').attr('src');
      console.log("Fetched CAPTCHA image data URL length:", captchaImg ? captchaImg.length : 0);
    } else {
      console.log("CAPTCHA type is Google ReCAPTCHA. No image to fetch.");
    }

  } catch (err) {
    console.log("Res2 failed with:", err.response?.status, err.response?.data);
  }
}

test();
