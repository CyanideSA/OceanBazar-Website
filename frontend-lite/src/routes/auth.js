const { bffFetch, BffError } = require('../bffClient');
const {
  loginWithPassword,
  loginWithOtp,
  registerUser,
  logoutUser,
} = require('../session');
const { safeNext } = require('../helpers');

function mountAuth(router) {
  router.get('/:locale/auth/login', (req, res) => {
    res.render('login', {
      title: res.locals.t('login'),
      next: safeNext(req.query.next, `/${req.locale}`),
      mode: req.query.mode === 'otp' ? 'otp' : 'password',
      target: req.query.target || '',
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
      return res.redirect(
        `/${locale}/auth/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(err.message || res.locals.t('errorGeneric'))}`,
      );
    }
  });

  router.post('/:locale/auth/otp/send', async (req, res) => {
    const locale = req.locale;
    const target = String(req.body.target || '').trim();
    const next = safeNext(req.body.next, `/${locale}`);
    try {
      await bffFetch('/api/auth/send-otp', {
        method: 'POST',
        body: { target, type: 'login' },
      });
      return res.redirect(
        `/${locale}/auth/login?mode=otp&target=${encodeURIComponent(target)}&next=${encodeURIComponent(next)}&flash=${encodeURIComponent('OTP sent')}`,
      );
    } catch (err) {
      return res.redirect(
        `/${locale}/auth/login?mode=otp&next=${encodeURIComponent(next)}&error=${encodeURIComponent(err.message)}`,
      );
    }
  });

  router.post('/:locale/auth/otp/verify', async (req, res) => {
    const locale = req.locale;
    const target = String(req.body.target || '').trim();
    const code = String(req.body.code || '').trim();
    const next = safeNext(req.body.next, `/${locale}`);
    try {
      await loginWithOtp(req, res, target, code);
      return res.redirect(next);
    } catch (err) {
      return res.redirect(
        `/${locale}/auth/login?mode=otp&target=${encodeURIComponent(target)}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(err.message)}`,
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
        `/${locale}/auth/register?next=${encodeURIComponent(next)}&error=${encodeURIComponent(msg)}`,
      );
    }
  });

  router.post('/:locale/auth/logout', async (req, res) => {
    await logoutUser(req, res);
    res.redirect(`/${req.locale}`);
  });

  router.get('/:locale/auth/logout', async (req, res) => {
    await logoutUser(req, res);
    res.redirect(`/${req.locale}`);
  });
}

module.exports = { mountAuth };
