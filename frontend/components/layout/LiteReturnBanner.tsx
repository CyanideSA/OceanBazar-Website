'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { isLegacyStorefrontDevice } from '@/lib/legacyDevice';

/**
 * Shown only on low-end UAs that somehow landed on the full site
 * (temporary bridge cookie, shared link, or Full site toggle).
 * One-tap return to Lite so they are not stranded.
 */
export default function LiteReturnBanner() {
  const locale = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isLegacyStorefrontDevice()) return;
    try {
      if (sessionStorage.getItem('ob_hide_lite_banner') === '1') return;
    } catch {
      /* private mode */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const liteBase = (process.env.NEXT_PUBLIC_LITE_SITE_URL || 'https://oceanbazar.com.bd/lite').replace(
    /\/$/,
    '',
  );
  const href = `${liteBase}/prefer?view=lite&next=${encodeURIComponent(`/${locale}`)}`;

  return (
    <div
      className="relative z-[60] flex items-center justify-between gap-3 bg-cyan-500 px-3 py-2 text-sm text-slate-950 sm:px-4"
      role="region"
      aria-label="Lite site"
    >
      <p className="min-w-0 flex-1 text-xs font-medium leading-snug sm:text-sm">
        Faster on this phone — switch back to Lite.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={href}
          className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          Open Lite
        </a>
        <button
          type="button"
          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900/80 hover:bg-cyan-400"
          aria-label="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem('ob_hide_lite_banner', '1');
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
