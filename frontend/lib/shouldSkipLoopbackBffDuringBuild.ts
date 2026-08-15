/**
 * Returns true when `next build` should not call the BFF at a loopback URL
 * (nothing listening → noisy fetch failures). Production deploys that use a real
 * API hostname still fetch normally.
 *
 * Set NEXT_FETCH_API_DURING_BUILD=1 to force fetches (CI with API running).
 */
export function shouldSkipLoopbackBffDuringBuild(): boolean {
  if (process.env.NEXT_FETCH_API_DURING_BUILD === '1' || process.env.NEXT_FETCH_API_DURING_BUILD === 'true') {
    return false;
  }

  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!api) return true;

  let hostname = '';
  try {
    hostname = new URL(api).hostname.toLowerCase();
  } catch {
    return false;
  }

  const loopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1';

  if (!loopback) return false;

  if (process.env.npm_lifecycle_event === 'build') return true;

  return process.argv.includes('build') && process.argv.some((a) => String(a).includes('next'));

}
