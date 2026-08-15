/** Public URL prefix when Lite is mounted on the apex (no subdomain DNS required). */
const BASE_PATH = String(process.env.BASE_PATH || '')
  .trim()
  .replace(/\/$/, '');

function bp(pathname) {
  const p = !pathname ? '/' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${BASE_PATH}${p}`;
}

module.exports = { BASE_PATH, bp };
