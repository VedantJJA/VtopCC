const { startLogin } = require('../dist/services/vtop.service.js');
const { CookieJar } = require('tough-cookie');
const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

async function testMultipleLogins() {
  console.log('Testing 5 consecutive startLogin() calls to see captchaType and images:');
  for (let i = 1; i <= 5; i++) {
    try {
      const res = await startLogin();
      console.log(`Call #${i}: captchaType=${res.captchaType}, imgLen=${res.captchaImageData?.length || 0}, csrf=${res.state.csrf?.slice(0, 10)}...`);
    } catch (e) {
      console.error(`Call #${i} failed:`, e.message);
    }
  }
}

testMultipleLogins();
