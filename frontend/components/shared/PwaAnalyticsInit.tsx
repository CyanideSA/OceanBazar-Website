'use client';

import { useEffect } from 'react';
import { trackPwaEvent } from '@/lib/pwaAnalytics';

/**
 * Listens for service worker postMessage (e.g. push received) and forwards to analytics.
 */
export default function PwaAnalyticsInit() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (ev: MessageEvent) => {
      const d = ev.data as { type?: string; tag?: string; title?: string } | undefined;
      if (!d?.type?.startsWith('OB_PWA_')) return;
      trackPwaEvent('pwa_sw_message', { swType: d.type, tag: d.tag, title: d.title });
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
