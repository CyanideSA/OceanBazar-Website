/** Any iPhone/iPad browser (Safari, Chrome/CriOS, Firefox, Edge — all WebKit under the hood). */
export function isIosWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iP(hone|od|ad)/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );
}

/** iPhone/iPad Safari (not Chrome/Firefox/Edge on iOS). */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (!isIosWebKit()) return false;
  // CriOS / FxiOS / EdgiOS are other browsers on iOS
  return /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua);
}

/** Coarse pointer + no hover — phones/tablets where WebKit compositor bugs show up. */
export function isTouchCoarse(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return isIosSafari();
  }
}
