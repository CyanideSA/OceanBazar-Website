const express = require('express');
const { safeNext } = require('../helpers');
const { BASE_PATH, bp } = require('../config');

const router = express.Router();

/**
 * Cookie lifetime for ob_view.
 * - default / omitted: 1 year (explicit Full site / Lite site toggle)
 * - ttl=session: session cookie (cleared when browser closes)
 * - ttl=4h / ttl=Nh: temporary prefer (bridge tools) so low-end UAs return to lite
 */
function cookieMaxAgeMs(ttlRaw) {
  const ttl = String(ttlRaw || '').toLowerCase().trim();
  if (!ttl || ttl === 'year' || ttl === 'permanent') {
    return 365 * 86400 * 1000;
  }
  if (ttl === 'session' || ttl === '0') {
    return undefined;
  }
  const hours = ttl.match(/^(\d+)\s*h$/);
  if (hours) {
    return Math.max(1, Number(hours[1])) * 3600 * 1000;
  }
  const days = ttl.match(/^(\d+)\s*d$/);
  if (days) {
    return Math.max(1, Number(days[1])) * 86400 * 1000;
  }
  return 365 * 86400 * 1000;
}

/**
 * GET /prefer?view=full|lite&next=&ttl=
 * Sets shared apex cookie so nginx + both apps respect the choice.
 */
router.get('/prefer', (req, res) => {
  const view = String(req.query.view || '').toLowerCase() === 'full' ? 'full' : 'lite';
  let nextPath = safeNext(req.query.next, `/${'bn'}`);
  const domain = (process.env.COOKIE_DOMAIN || '').trim() || undefined;
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.TRUST_PROXY === '1';

  const maxAge = cookieMaxAgeMs(req.query.ttl);
  const cookieOpts = {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
    ...(domain ? { domain } : {}),
  };
  if (maxAge !== undefined) {
    cookieOpts.maxAge = maxAge;
  }

  res.cookie('ob_view', view, cookieOpts);

  if (view === 'full') {
    const full = (process.env.FULL_SITE_ORIGIN || 'https://oceanbazar.com.bd').replace(/\/$/, '');
    let fullNext = nextPath;
    if (BASE_PATH && fullNext.startsWith(BASE_PATH)) {
      fullNext = fullNext.slice(BASE_PATH.length) || '/bn';
    }
    return res.redirect(302, `${full}${fullNext}`);
  }

  if (BASE_PATH && !nextPath.startsWith(BASE_PATH)) {
    nextPath = bp(nextPath);
  }
  return res.redirect(302, nextPath);
});

module.exports = router;
