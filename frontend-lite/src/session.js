const { bffFetch, BffError } = require('./bffClient');

const ACCESS_COOKIE = 'ob_lite_access';
const REFRESH_COOKIE = 'ob_lite_refresh';

function cookieOpts() {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.TRUST_PROXY === '1';
  const domain = (process.env.COOKIE_DOMAIN || '').trim() || undefined;
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

function setSessionCookies(res, access, refresh) {
  const base = cookieOpts();
  if (access) {
    res.cookie(ACCESS_COOKIE, access, { ...base, maxAge: 55 * 60 * 1000 });
  }
  if (refresh) {
    res.cookie(REFRESH_COOKIE, refresh, { ...base, maxAge: 7 * 86400 * 1000 });
  }
}

function clearSessionCookies(res) {
  const base = cookieOpts();
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
  // Also clear BFF cookie name if present on shared domain
  res.clearCookie('refreshToken', base);
}

function readTokens(req) {
  return {
    accessToken: req.cookies?.[ACCESS_COOKIE] || '',
    refreshToken: req.cookies?.[REFRESH_COOKIE] || req.cookies?.refreshToken || '',
  };
}

async function refreshAccess(req, res) {
  const { refreshToken } = readTokens(req);
  if (!refreshToken) return null;
  try {
    const { data } = await bffFetch('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      refreshToken,
      mobileAuth: true,
    });
    const access = data?.access || data?.accessToken;
    const refresh = data?.refresh || refreshToken;
    if (access) setSessionCookies(res, access, refresh);
    return access || null;
  } catch {
    clearSessionCookies(res);
    return null;
  }
}

/**
 * Authenticated BFF call with automatic 401 refresh retry.
 */
async function authedFetch(req, res, path, opts = {}) {
  let { accessToken, refreshToken } = readTokens(req);
  try {
    return await bffFetch(path, {
      ...opts,
      accessToken,
      refreshToken,
      mobileAuth: opts.mobileAuth,
    });
  } catch (err) {
    if (!(err instanceof BffError) || err.status !== 401 || !refreshToken) throw err;
    accessToken = await refreshAccess(req, res);
    if (!accessToken) throw err;
    return bffFetch(path, {
      ...opts,
      accessToken,
      refreshToken: readTokens(req).refreshToken,
      mobileAuth: opts.mobileAuth,
    });
  }
}

async function loadUser(req, res) {
  const { accessToken, refreshToken } = readTokens(req);
  if (!accessToken && !refreshToken) return null;
  try {
    const { data } = await authedFetch(req, res, '/api/auth/me');
    return data?.user || data || null;
  } catch {
    return null;
  }
}

async function mergeGuestCartAfterLogin(req, res, accessToken) {
  const { readGuestCart, clearGuestCart } = require('./guestCart');
  const guest = readGuestCart(req);
  if (!guest.items?.length || !accessToken) return;
  let merged = 0;
  for (const item of guest.items) {
    try {
      await bffFetch('/api/cart/add', {
        method: 'POST',
        body: {
          productId: item.productId,
          quantity: Number(item.quantity) || 1,
          variantId: item.variantId || undefined,
        },
        accessToken,
        mobileAuth: true,
      });
      merged += 1;
    } catch {
      /* keep going — partial merge is OK */
    }
  }
  clearGuestCart(res);
  // #region agent log
  try {
    const fs = require('fs');
    const path = require('path');
    fs.appendFileSync(
      path.resolve(__dirname, '../../debug-1eb282.log'),
      `${JSON.stringify({
        sessionId: '1eb282',
        runId: 'pre-fix',
        hypothesisId: 'H10',
        location: 'session.js:mergeGuestCartAfterLogin',
        message: 'merged lite guest cart after login',
        data: { guestLines: guest.items.length, merged },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion
}

async function loginWithPassword(req, res, identifier, password) {
  const { normalizeAuthTarget } = require('./authNormalize');
  const normalizedId = normalizeAuthTarget(identifier) || String(identifier || '').trim().toLowerCase();
  try {
    const { data, status } = await bffFetch('/api/auth/login', {
      method: 'POST',
      body: { identifier: normalizedId, password },
      mobileAuth: true,
    });
    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(
        path.resolve(__dirname, '../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'session.js:loginWithPassword',
          message: 'lite password login response',
          data: {
            status,
            requiresEmailOtp: Boolean(data?.requiresEmailOtp),
            hasAccess: Boolean(data?.access || data?.accessToken),
            idKind: normalizedId.includes('@') ? 'email' : 'phone_or_other',
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    // Some accounts require a second email OTP step (same as live storefront).
    if (data?.requiresEmailOtp || status === 202) {
      const err = new BffError(202, 'EMAIL_OTP_REQUIRED', data);
      err.requiresEmailOtp = true;
      err.verificationTarget = data?.verificationTarget || normalizedId;
      throw err;
    }
    const access = data?.access || data?.accessToken;
    const refresh = data?.refresh;
    if (!access) throw new BffError(500, 'No access token in login response', data);
    setSessionCookies(res, access, refresh);
    await mergeGuestCartAfterLogin(req, res, access);
    return data?.user || null;
  } catch (err) {
    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(
        path.resolve(__dirname, '../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'session.js:loginWithPassword:catch',
          message: 'lite password login failed',
          data: {
            status: err?.status || null,
            msg: String(err?.message || err).slice(0, 160),
            requiresEmailOtp: Boolean(err?.requiresEmailOtp),
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    throw err;
  }
}

async function loginWithFirebase(req, res, idToken) {
  const { data } = await bffFetch('/api/auth/firebase', {
    method: 'POST',
    body: { idToken },
    mobileAuth: true,
  });
  const access = data?.access || data?.accessToken || data?.token;
  const refresh = data?.refresh;
  if (!access) throw new BffError(500, 'No access token in firebase login response', data);
  setSessionCookies(res, access, refresh);
  await mergeGuestCartAfterLogin(req, res, access);
  return data?.user || null;
}

async function loginWithOtp(req, res, target, code) {
  const { normalizeAuthTarget, normalizeOtpCode } = require('./authNormalize');
  const normalizedTarget = normalizeAuthTarget(target);
  const normalizedCode = normalizeOtpCode(code);
  const { data } = await bffFetch('/api/auth/verify-otp', {
    method: 'POST',
    body: { target: normalizedTarget, code: normalizedCode, type: 'login' },
    mobileAuth: true,
  });
  const access = data?.access || data?.accessToken || data?.token;
  const refresh = data?.refresh || data?.refreshToken;
  if (!access) throw new BffError(401, 'Invalid or expired OTP', data);
  setSessionCookies(res, access, refresh);
  await mergeGuestCartAfterLogin(req, res, access);
  return data;
}

async function registerUser(req, res, payload) {
  const { data } = await bffFetch('/api/auth/register', {
    method: 'POST',
    body: payload,
    mobileAuth: true,
  });
  const access = data?.access || data?.accessToken;
  const refresh = data?.refresh;
  if (access) {
    setSessionCookies(res, access, refresh);
    await mergeGuestCartAfterLogin(req, res, access);
  }
  return data;
}

async function logoutUser(req, res) {
  try {
    await authedFetch(req, res, '/api/auth/logout', { method: 'POST', body: {} });
  } catch {
    /* ignore */
  }
  clearSessionCookies(res);
}

function requireAuth(req, res, next) {
  const { accessToken, refreshToken } = readTokens(req);
  if (!accessToken && !refreshToken) {
    const { bp } = require('./config');
    const locale = req.locale || 'bn';
    return res.redirect(
      `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(req.originalUrl)}`,
    );
  }
  return next();
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setSessionCookies,
  clearSessionCookies,
  readTokens,
  refreshAccess,
  authedFetch,
  loadUser,
  loginWithPassword,
  loginWithFirebase,
  loginWithOtp,
  registerUser,
  logoutUser,
  requireAuth,
};
