'use client';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LfyXMMsAAAAADjhHevKP5FaomvzbG4XmQOYZBUZ';

let loaded = false;

export function loadRecaptchaScript(): Promise<void> {
  if (loaded || typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    if (document.querySelector(`script[src*="recaptcha/enterprise.js"]`)) {
      loaded = true;
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => { loaded = true; resolve(); };
    document.head.appendChild(s);
  });
}

export async function executeRecaptcha(action: string): Promise<string> {
  await loadRecaptchaScript();
  return new Promise((resolve, reject) => {
    const g = (window as any).grecaptcha?.enterprise;
    if (!g) { resolve(''); return; }
    g.ready(() => {
      g.execute(SITE_KEY, { action })
        .then((token: string) => resolve(token))
        .catch(() => resolve(''));
    });
  });
}
