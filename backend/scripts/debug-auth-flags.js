const recaptcha = require('./dist/services/recaptchaService');
(async () => {
  console.log('configured=' + recaptcha.isRecaptchaConfigured());
  console.log('empty=' + JSON.stringify(await recaptcha.verifyRecaptchaToken('', 'register')));
  console.log('x=' + JSON.stringify(await recaptcha.verifyRecaptchaToken('x', 'register')));
  const id = process.env.GOOGLE_CLIENT_ID || '';
  const sec = process.env.GOOGLE_CLIENT_SECRET || '';
  console.log('hasGoogle=' + !!(id && sec && !id.startsWith('your_')));
  console.log('idLen=' + id.length + ' secLen=' + sec.length);
})();
