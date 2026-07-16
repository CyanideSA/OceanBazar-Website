/**
 * Content-Security-Policy built from inventory (see docs/CSP_INVENTORY.md).
 * Use CSP_MODE=report-only | enforce (default report-only in production when unset).
 */
export function getCspDirectives() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const apiOrigin = (() => {
    try {
      return new URL(api).origin;
    } catch {
      return 'http://127.0.0.1:4000';
    }
  })();

  const extraConnect = (process.env.NEXT_PUBLIC_CSP_EXTRA_CONNECT_SRC || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    [
      'script-src',
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://www.google.com',
      'https://www.gstatic.com',
      'https://www.recaptcha.net',
      'https://www.googletagmanager.com',
      'https://connect.facebook.net',
    ].join(' '),
    [
      'style-src',
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
    ].join(' '),
    ["font-src", "'self'", 'https://fonts.gstatic.com', 'data:'].join(' '),
    [
      'img-src',
      "'self'",
      'data:',
      'blob:',
      'https:',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ].join(' '),
    [
      'connect-src',
      "'self'",
      apiOrigin,
      'https:',
      'wss:',
      'ws:',
      'https://*.googleapis.com',
      'https://*.cloudinary.com',
      'https://www.google.com',
      'https://www.recaptcha.net',
      ...extraConnect,
    ].join(' '),
    [
      'frame-src',
      "'self'",
      'https://www.google.com',
      'https://recaptcha.google.com',
      'https://www.recaptcha.net',
    ].join(' '),
    "object-src 'none'",
  ];

  if (process.env.CSP_UPGRADE_INSECURE === 'true') {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export function getCspHeaderPair() {
  const mode = (process.env.CSP_MODE || 'report-only').toLowerCase();
  const value = getCspDirectives();
  if (mode === 'enforce') {
    return { key: 'Content-Security-Policy', value };
  }
  return { key: 'Content-Security-Policy-Report-Only', value };
}
