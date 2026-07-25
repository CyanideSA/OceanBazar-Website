const express = require('express');
const { safeNext } = require('../helpers');
const { BASE_PATH, bp } = require('../config');

const router = express.Router();

/**
 * GET /prefer?view=full|lite&next=
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

  // #region agent log
  try {
    const fs = require('fs');
    const line = JSON.stringify({
      sessionId: '078c95',
      runId: 'lite-path',
      hypothesisId: 'H1',
      location: 'prefer.js',
      message: 'prefer toggle',
      data: { view, nextPath, basePath: BASE_PATH },
      timestamp: Date.now(),
    });
    fs.appendFileSync('/tmp/debug-078c95-lite.log', `${line}\n`);
  } catch {
    /* ignore */
  }
  // #endregion

  res.cookie('ob_view', view, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 365 * 86400 * 1000,
    ...(domain ? { domain } : {}),
  });

  if (view === 'full') {
    const full = (process.env.FULL_SITE_ORIGIN || 'https://oceanbazar.com.bd').replace(/\/$/, '');
    // Strip /lite prefix when returning to the high-end site
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
