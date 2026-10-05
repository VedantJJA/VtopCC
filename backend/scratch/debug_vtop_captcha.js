const { startLogin } = require('../dist/services/vtop.service.js');
const fs = require('fs');

async function test() {
  console.log('Calling startLogin()...');
  try {
    const result = await startLogin();
    console.log('Result:');
    console.log('- captchaType:', result.captchaType);
    console.log('- captchaImageData length:', result.captchaImageData ? result.captchaImageData.length : 0);
    console.log('- captchaImageData preview:', result.captchaImageData ? result.captchaImageData.slice(0, 100) : 'none');
    console.log('- csrf:', result.state.csrf);
  } catch (e) {
    console.error('startLogin threw:', e);
  }
}

test();
