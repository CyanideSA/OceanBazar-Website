const BFF_BASE = (process.env.BFF_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000')
  .replace(/\/$/, '');

class BffError extends Error {
  constructor(status, message, body) {
    super(message || `BFF ${status}`);
    this.name = 'BffError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Low-level fetch to the Node BFF. Never called from the browser.
 * @param {string} path e.g. '/api/products'
 * @param {object} opts
 */
async function bffFetch(path, opts = {}) {
  const {
    method = 'GET',
    query,
    body,
    accessToken,
    refreshToken,
    headers = {},
    mobileAuth = false,
  } = opts;

  const url = new URL(path.startsWith('http') ? path : `${BFF_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const reqHeaders = {
    Accept: 'application/json',
    'X-Requested-With': 'oceanbazar-lite',
    ...headers,
  };
  if (mobileAuth) reqHeaders['X-Client-Platform'] = 'mobile';
  if (accessToken) reqHeaders.Authorization = `Bearer ${accessToken}`;
  if (refreshToken) {
    reqHeaders.Cookie = `refreshToken=${refreshToken}`;
    reqHeaders['X-Refresh-Token'] = refreshToken;
  }

  const init = { method, headers: reqHeaders };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    reqHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), init);
  } catch (err) {
    throw new BffError(502, err.message || 'BFF unreachable');
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.msg)) ||
      `Request failed (${res.status})`;
    throw new BffError(res.status, String(msg), data);
  }

  return { data, status: res.status, headers: res.headers };
}

async function bffGet(path, query, auth = {}) {
  const { data } = await bffFetch(path, { query, ...auth });
  return data;
}

async function bffSend(method, path, body, auth = {}, extra = {}) {
  const { data } = await bffFetch(path, { method, body, ...auth, ...extra });
  return data;
}

module.exports = {
  BFF_BASE,
  BffError,
  bffFetch,
  bffGet,
  bffSend,
};
