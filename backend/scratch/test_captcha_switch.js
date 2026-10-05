const { CookieJar } = require('tough-cookie');
const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

// Test what get/new/captcha returns
async function testCaptchaSwitch() {
  const jar = new CookieJar();
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  // Custom client mimicking vtop.service
  const client = axios.create({
    baseURL: 'https://vtopcc.vit.ac.in/vtop/',
    httpsAgent: agent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  // Let's add cookies manually
  client.interceptors.request.use(async config => {
    const url = config.url.startsWith('http') ? config.url : (config.baseURL + config.url);
    const cookie = await jar.getCookieString(url);
    if (cookie) config.headers.Cookie = cookie;
    return config;
  });
  client.interceptors.response.use(async res => {
    const raw = res.headers['set-cookie'];
    if (raw) {
      const cookies = Array.isArray(raw) ? raw : [raw];
      for (const c of cookies) {
        await jar.setCookie(c, res.config.url.startsWith('http') ? res.config.url : (res.config.baseURL + res.config.url));
      }
    }
    return res;
  });

  console.log('1. GET open/page...');
  const openRes = await client.get('open/page');
  const csrfPrelogin = openRes.data.match(/name="_csrf"\s+value="([^"]+)"/)?.[1] || cheerio.load(openRes.data)('input[name="_csrf"]').val();

  console.log('2. POST prelogin/setup...');
  const p = new URLSearchParams();
  p.append('_csrf', csrfPrelogin);
  p.append('flag', 'VTOP');
  const preRes = await client.post('prelogin/setup', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  const capMatch = preRes.data.match(/var\s+captchaType\s*=\s*(\d+)/i) || preRes.data.match(/captchaType\s*=\s*(\d+)/i);
  const capType = capMatch ? parseInt(capMatch[1], 10) : 1;
  console.log('CaptchaType in prelogin:', capType);

  console.log('3. Calling get/new/captcha regardless of captchaType...');
  try {
    const capRes = await client.get('get/new/captcha');
    console.log('get/new/captcha response status:', capRes.status, 'len:', capRes.data.length);
    const $ = cheerio.load(capRes.data);
    const img1 = $('#captchaBlock img').attr('src');
    const img2 = $('img[src^="data:image"]').attr('src');
    const img3 = $('img').attr('src');
    console.log('Images found:');
    console.log('- #captchaBlock img:', img1?.slice(0, 50));
    console.log('- img[src^=data:image]:', img2?.slice(0, 50));
    console.log('- any img:', img3?.slice(0, 50));
    console.log('Raw body snippet:', capRes.data.slice(0, 300));
  } catch (e) {
    console.error('get/new/captcha failed:', e.message);
  }
}

testCaptchaSwitch();
