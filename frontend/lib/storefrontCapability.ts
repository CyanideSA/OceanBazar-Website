/**
 * Shared live↔lite eligibility rules.
 * Must stay aligned with nginx `map $http_user_agent $ob_old_ua`
 * and the Lite device hint in `app/layout.tsx`.
 *
 * Intentionally UA-first. Do NOT use deviceMemory / hardwareConcurrency for
 * redirects — Safari on modern iPhones under-reports and false-positives.
 *
 * Android ≤12 covers Pixel 4 and most low-RAM BD phones still on 11/12.
 */
export function isLowEndStorefrontUa(ua: string): boolean {
  const s = String(ua || '');
  if (/iP(hone|od|ad).*OS (1[0-5])_/i.test(s)) return true;
  if (/Android (?:[4-9]\.|1[0-2][;.)])/i.test(s)) return true;
  return false;
}

/** Soft UI degradation only — same UA gate as routing. */
export function isLegacyStorefrontDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isLowEndStorefrontUa(navigator.userAgent || '');
}
