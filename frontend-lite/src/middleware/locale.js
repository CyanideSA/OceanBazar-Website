const { LOCALES, DEFAULT_LOCALE, isLocale, makeT } = require('../i18n');
const helpers = require('../helpers');
const { loadUser, readTokens } = require('../session');
const { bffGet } = require('../bffClient');
const { authedFetch } = require('../session');
const { BASE_PATH, bp } = require('../config');

/** Short-lived nav category cache — avoids a cold BFF hit on every page. */
let navCatsCache = { at: 0, items: [] };

async function loadNavCategories() {
  const now = Date.now();
  if (navCatsCache.items.length && now - navCatsCache.at < 5 * 60 * 1000) {
    return navCatsCache.items;
  }
  try {
    const raw = await bffGet('/api/categories');
    const list = helpers.unwrapList(raw, ['categories', 'data']);
    const top = list.filter((c) => !c.parentId && !c.parent_id && !c.parent);
    const items = (top.length ? top : list).slice(0, 14);
    navCatsCache = { at: now, items };
    return items;
  } catch {
    return navCatsCache.items || [];
  }
}

async function attachLocals(req, res, next) {
  const locale = req.locale || DEFAULT_LOCALE;
  const t = makeT(locale);
  const fullSiteOrigin = (process.env.FULL_SITE_ORIGIN || 'https://oceanbazar.com.bd').replace(/\/$/, '');
  const liteOrigin = (process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '') || `${fullSiteOrigin}${BASE_PATH}`;

  let user = null;
  let settings = {};
  let flash = null;
  let cartCount = 0;
  let navCategories = [];

  const [settingsRes, flashRes, catsRes] = await Promise.all([
    bffGet('/api/storefront/settings').catch(() => ({})),
    bffGet('/api/flash-sales/active', { lang: locale }).catch(() => null),
    loadNavCategories(),
  ]);
  settings = settingsRes || {};
  flash = flashRes;
  navCategories = catsRes || [];

  try {
    user = await loadUser(req, res);
    // #region agent log
    if (user) {
      try {
        const fs = require('fs');
        const path = require('path');
        fs.appendFileSync(
          path.resolve(__dirname, '../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'avatar-ob',
            hypothesisId: 'H-LITE-AVATAR',
            location: 'locale.js:loadUser',
            message: 'lite user avatar fields',
            data: {
              hasProfileImage: Boolean(user.profileImage || user.profile_image || user.avatar),
              keys: Object.keys(user).filter((k) => /image|avatar|photo/i.test(k)).slice(0, 8),
            },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
    }
    // #endregion
  } catch {
    user = null;
  }

  if (user || readTokens(req).accessToken || readTokens(req).refreshToken) {
    try {
      const { data } = await authedFetch(req, res, '/api/cart');
      const items = data?.items || data?.cart?.items || [];
      cartCount = Array.isArray(items)
        ? items.reduce((sum, it) => sum + Number(it.quantity || 1), 0)
        : 0;
    } catch {
      cartCount = 0;
    }
  }

  const flashMs = helpers.flashRemainingMs(flash?.sale || flash);
  res.locals = {
    ...res.locals,
    locale,
    locales: LOCALES,
    t,
    helpers,
    bp,
    basePath: BASE_PATH,
    user,
    settings,
    flash,
    flashCountdown: helpers.formatCountdown(flashMs),
    flashMs,
    cartCount,
    navCategories,
    fullSiteOrigin,
    liteOrigin,
    flashMsg: typeof req.query.flash === 'string' ? req.query.flash : '',
    errorMsg: typeof req.query.error === 'string' ? req.query.error : '',
    path: req.path,
    query: req.query,
    year: new Date().getFullYear(),
  };
  next();
}

function localeRouter(createAppRoutes) {
  const express = require('express');
  const router = express.Router({ mergeParams: true });

  router.param('locale', (req, res, next, value) => {
    if (!isLocale(value)) return res.redirect(`/${DEFAULT_LOCALE}`);
    req.locale = value;
    next();
  });

  router.use('/:locale', attachLocals);
  createAppRoutes(router);
  return router;
}

module.exports = { attachLocals, localeRouter, LOCALES, DEFAULT_LOCALE, isLocale };
