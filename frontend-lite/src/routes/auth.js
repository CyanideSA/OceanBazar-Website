const { bffFetch, BffError } = require('../bffClient');
const {
  loginWithPassword,
  loginWithFirebase,
  loginWithOtp,
  registerUser,
  logoutUser,
} = require('../session');
const { safeNext } = require('../helpers');
const { bp } = require('../config');

function firebasePublicConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
  };
}

function mountAuth(router) {
  router.get('/:locale/auth/login', (req, res) => {
    const { normalizeAuthTarget } = require('../authNormalize');
    const target = normalizeAuthTarget(req.query.target || '');
    const fb = firebasePublicConfig();
    res.render('login', {
      title: res.locals.t('login'),
      next: safeNext(req.query.next, `/${req.locale}`),
      mode: req.query.mode === 'otp' ? 'otp' : 'password',
      target,
      googleEnabled: Boolean(fb.apiKey && fb.authDomain && fb.projectId && fb.appId),
    });
  });

  router.post('/:locale/auth/login', async (req, res) => {
    const locale = req.locale;
    const next = safeNext(req.body.next, `/${locale}`);
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');
    try {
      await loginWithPassword(req, res, identifier, password);
      return res.redirect(next);
    } catch (err) {
      if (err && (err.requiresEmailOtp || err.status === 202 || err.message === 'EMAIL_OTP_REQUIRED')) {
        const target = err.verificationTarget || identifier;
        return res.redirect(
          `${bp(`/${locale}/auth/login`)}?mode=otp&target=${encodeURIComponent(target)}&next=${encodeURIComponent(next)}&flash=${encodeURIComponent(res.locals.t('otpSentCheckEmail') || 'OTP sent to your email')}`,
        );
      }
      const msg = err instanceof BffError ? err.message : (err.message || res.locals.t('errorGeneric'));
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(next)}&error=${encodeURIComponent(msg)}`,
      );
    }
  });

  /** Google sign-in via Firebase redirect (low-end friendly — no popup). */
  router.get('/:locale/auth/google', (req, res) => {
    const locale = req.locale;
    const next = safeNext(req.query.next, `/${locale}`);
    const fb = firebasePublicConfig();
    if (!fb.apiKey) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(next)}&error=${encodeURIComponent('Google sign-in is not configured')}`,
      );
    }
    res.render('auth-google', {
      title: res.locals.t('continueWithGoogle') || 'Google',
      next,
      firebaseConfig: fb,
    });
  });

  router.post('/:locale/auth/firebase', async (req, res) => {
    const locale = req.locale;
    const next = safeNext(req.body.next, `/${locale}`);
    const idToken = String(req.body.idToken || '').trim();
    if (!idToken) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(next)}&error=${encodeURIComponent('Missing Google token')}`,
      );
    }
    try {
      await loginWithFirebase(req, res, idToken);
      return res.redirect(next);
    } catch (err) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(next)}&error=${encodeURIComponent(err.message || res.locals.t('errorGeneric'))}`,
      );
    }
  });

  router.post('/:locale/auth/otp/send', async (req, res) => {
    const locale = req.locale;
    const { normalizeAuthTarget } = require('../authNormalize');
    const target = normalizeAuthTarget(req.body.target || '');
    const next = safeNext(req.body.next, `/${locale}`);
    if (!target) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?mode=otp&next=${encodeURIComponent(next)}&error=${encodeURIComponent('Email or phone required')}`,
      );
    }
    try {
      await bffFetch('/api/auth/send-otp', {
        method: 'POST',
        body: { target, type: 'login' },
      });
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?mode=otp&target=${encodeURIComponent(target)}&next=${encodeURIComponent(next)}&flash=${encodeURIComponent('OTP sent')}`,
      );
    } catch (err) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?mode=otp&next=${encodeURIComponent(next)}&error=${encodeURIComponent(err.message)}`,
      );
    }
  });

  router.post('/:locale/auth/otp/verify', async (req, res) => {
    const locale = req.locale;
    const { normalizeAuthTarget, normalizeOtpCode } = require('../authNormalize');
    const target = normalizeAuthTarget(req.body.target || '');
    const code = normalizeOtpCode(req.body.code || '');
    const next = safeNext(req.body.next, `/${locale}`);
    try {
      await loginWithOtp(req, res, target, code);
      return res.redirect(next);
    } catch (err) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?mode=otp&target=${encodeURIComponent(target)}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(err.message)}`,
      );
    }
  });

  router.get('/:locale/auth/register', (req, res) => {
    res.render('register', {
      title: res.locals.t('register'),
      next: safeNext(req.query.next, `/${req.locale}`),
    });
  });

  router.post('/:locale/auth/register', async (req, res) => {
    const locale = req.locale;
    const next = safeNext(req.body.next, `/${locale}`);
    try {
      await registerUser(req, res, {
        name: String(req.body.name || '').trim(),
        email: String(req.body.email || '').trim() || undefined,
        phone: String(req.body.phone || '').trim() || undefined,
        password: String(req.body.password || ''),
      });
      return res.redirect(next);
    } catch (err) {
      const msg = err instanceof BffError ? err.message : res.locals.t('errorGeneric');
      return res.redirect(
        `${bp(`/${locale}/auth/register`)}?next=${encodeURIComponent(next)}&error=${encodeURIComponent(msg)}`,
      );
    }
  });

  router.post('/:locale/auth/logout', async (req, res) => {
    await logoutUser(req, res);
    res.redirect(bp(`/${req.locale}`));
  });

  router.get('/:locale/auth/logout', async (req, res) => {
    await logoutUser(req, res);
    res.redirect(bp(`/${req.locale}`));
  });
}

module.exports = { mountAuth };
