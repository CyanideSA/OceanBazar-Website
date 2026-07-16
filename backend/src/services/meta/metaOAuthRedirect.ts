const DEFAULT_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'api.oceanbazar.com.bd',
  'api.oceanbazar.com',
];

export function getValidatedMetaOAuthRedirectUri(): string | null {
  const raw = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (!raw) return null;

  const allowedHosts = new Set(
    (process.env.META_OAUTH_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(','))
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    if (url.username || url.password) return null;
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) return null;
    if (!allowedHosts.has(hostname)) return null;

    return url.toString();
  } catch {
    return null;
  }
}
