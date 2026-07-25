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

async function loginWithPassword(req, res, identifier, password) {
  const { data } = await bffFetch('/api/auth/login', {
    method: 'POST',
    body: { identifier, password },
    mobileAuth: true,
  });
  const access = data?.access || data?.accessToken;
  const refresh = data?.refresh;
  if (!access) throw new BffError(500, 'No access token in login response', data);
  setSessionCookies(res, access, refresh);
  return data?.user || null;
}

async function loginWithOtp(req, res, target, code) {
  const { data } = await bffFetch('/api/auth/verify-otp', {
    method: 'POST',
    body: { target, code, type: 'login' },
    mobileAuth: true,
  });
  const access = data?.access || data?.accessToken;
  const refresh = data?.refresh;
  if (access) setSessionCookies(res, access, refresh);
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
  if (access) setSessionCookies(res, access, refresh);
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
  loginWithOtp,
  registerUser,
  logoutUser,
  requireAuth,
};
