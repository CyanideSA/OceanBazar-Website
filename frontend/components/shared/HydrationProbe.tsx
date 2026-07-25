'use client';

import { useEffect } from 'react';
import { debugSessionLog } from '@/lib/debugSessionLog';
import { isLegacyStorefrontDevice } from '@/lib/legacyDevice';
import { isIosWebKit } from '@/lib/iosSafari';

/** Confirms ShopShell hydrated and surfaces early script failures on old phones. */
export default function HydrationProbe() {
  useEffect(() => {
    // #region agent log
    try {
      (window as unknown as { __ob_hydrated?: boolean }).__ob_hydrated = true;
    } catch {
      /* ignore */
    }
    debugSessionLog({
      hypothesisId: 'H11',
      location: 'HydrationProbe.tsx:mount',
      message: 'shop shell hydrated',
      data: {
        legacy: isLegacyStorefrontDevice(),
        ios: isIosWebKit(),
        cores: navigator.hardwareConcurrency || null,
        mem: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      },
      runId: 'post-test-hydration',
    });
    // #endregion

    const onError = (event: ErrorEvent) => {
      // #region agent log
      debugSessionLog({
        hypothesisId: 'H11',
        location: 'HydrationProbe.tsx:window-error',
        message: 'window error after hydrate',
        data: {
          msg: String(event.message || '').slice(0, 220),
          filename: String(event.filename || '').slice(0, 140),
          lineno: event.lineno || null,
        },
        runId: 'post-test-hydration',
      });
      // #endregion
    };
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);

  return null;
}
