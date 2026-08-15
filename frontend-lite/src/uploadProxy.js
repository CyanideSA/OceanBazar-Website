const { BFF_BASE, BffError } = require('./bffClient');
const { readTokens } = require('./session');

/**
 * Stream multipart request body to BFF upload endpoints (Node 18+ duplex).
 */
async function proxyUpload(req, res, apiPath) {
  const { accessToken, refreshToken } = readTokens(req);
  if (!accessToken && !refreshToken) {
    throw new BffError(401, 'Sign in required');
  }
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().includes('multipart/form-data')) {
    throw new BffError(400, 'Expected multipart upload');
  }
  const headers = {
    Accept: 'application/json',
    'X-Requested-With': 'oceanbazar-lite',
    'Content-Type': ct,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (refreshToken) {
    headers.Cookie = `refreshToken=${refreshToken}`;
    headers['X-Refresh-Token'] = refreshToken;
  }
  const upstream = await fetch(`${BFF_BASE}${apiPath}`, {
    method: 'POST',
    headers,
    body: req,
    duplex: 'half',
  });
  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  if (!upstream.ok) {
    const msg = (data && (data.error || data.message)) || `Upload failed (${upstream.status})`;
    throw new BffError(upstream.status, String(msg), data);
  }
  return data;
}

module.exports = { proxyUpload };
