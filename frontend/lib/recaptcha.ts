'use client';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeXgl0tAAAAAJP4H-8VX2gfrkDJn3Y5QW26ioUF';

let loadPromise: Promise<void> | null = null;

function getEnterprise(): { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> } | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { grecaptcha?: { enterprise?: ReturnType<typeof getEnterprise> } }).grecaptcha?.enterprise ?? null;
}

export function loadRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (getEnterprise()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src*="recaptcha/enterprise.js"]`) as HTMLScriptElement | null;
    if (existing) {
      const wait = () => {
        if (getEnterprise()) resolve();
        else setTimeout(wait, 50);
      };
      wait();
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      const wait = (tries = 0) => {
        if (getEnterprise()) resolve();
        else if (tries > 100) reject(new Error('reCAPTCHA failed to initialize'));
        else setTimeout(() => wait(tries + 1), 50);
      };
      wait();
    };
    s.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load reCAPTCHA script'));
    };
    document.head.appendChild(s);
  });

  return loadPromise;
}

/** Score-based Enterprise token (invisible — no checkbox UI). */
export async function executeRecaptcha(action: string): Promise<string> {
  try {
    await loadRecaptchaScript();
  } catch {
    return '';
  }

  const g = getEnterprise();
  if (!g) {
    return '';
  }

  return new Promise((resolve) => {
    g.ready(() => {
      g.execute(SITE_KEY, { action })
        .then((token: string) => {
          resolve(token || '');
        })
        .catch((err: unknown) => {
          resolve('');
        });
    });
  });
}

export function getRecaptchaSiteKey(): string {
  return SITE_KEY;
}

const BADGE_CLASS = 'ob-recaptcha-badge';
let badgeRefCount = 0;

/**
 * Load Enterprise script and show Google's "protected by reCAPTCHA" badge.
 * Call from register / password-reset / account password UIs.
 * Pair with hideRecaptchaBadge (or use useRecaptchaBadge) on unmount.
 */
export async function showRecaptchaBadge(surface?: string): Promise<void> {
  if (typeof document === 'undefined') return;
  badgeRefCount += 1;
  document.documentElement.classList.add(BADGE_CLASS);
  try {
    await loadRecaptchaScript();
    // Force badge widget to mount (Enterprise may defer until execute)
    const g = getEnterprise();
    if (g) {
      await new Promise<void>((resolve) => {
        g.ready(() => {
          g.execute(SITE_KEY, { action: 'badge_show' }).catch(() => '').finally(() => resolve());
        });
      });
    }
  } catch { /* script optional for badge intent logging */ }
  const badge = document.querySelector('.grecaptcha-badge') as HTMLElement | null;
  const cs = badge ? getComputedStyle(badge) : null;
}

export function hideRecaptchaBadge(surface?: string): void {
  if (typeof document === 'undefined') return;
  badgeRefCount = Math.max(0, badgeRefCount - 1);
  if (badgeRefCount === 0) {
    document.documentElement.classList.remove(BADGE_CLASS);
  }
}
