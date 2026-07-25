const { LOCALES, DEFAULT_LOCALE, isLocale, makeT } = require('../i18n');
const helpers = require('../helpers');
const { loadUser, readTokens } = require('../session');
const { bffGet } = require('../bffClient');
const { authedFetch } = require('../session');

async function attachLocals(req, res, next) {
  const locale = req.locale || DEFAULT_LOCALE;
  const t = makeT(locale);
  const fullSiteOrigin = (process.env.FULL_SITE_ORIGIN || 'https://oceanbazar.com.bd').replace(/\/$/, '');
  const liteOrigin = (process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '');

  let user = null;
  let settings = {};
  let flash = null;
  let cartCount = 0;

  try {
    settings = (await bffGet('/api/storefront/settings')) || {};
  } catch {
    settings = {};
  }

  try {
    flash = await bffGet('/api/flash-sales/active', { lang: locale });
  } catch {
    flash = null;
  }

  try {
    user = await loadUser(req, res);
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
    user,
    settings,
    flash,
    flashCountdown: helpers.formatCountdown(flashMs),
    flashMs,
    cartCount,
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
