'use client';

type PwaPayload = Record<string, unknown>;

function analyticsBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  return base.replace(/\/$/, '');
}

/**
 * PWA / install / push funnel. Sends:
 * - optional sendBeacon to BFF `/api/analytics/pwa`
 * - CustomEvent `ob-pwa` for GTM / dataLayer bridges
 */
export function trackPwaEvent(event: string, props?: PwaPayload) {
  if (typeof window === 'undefined') return;
  const detail = { event, ts: Date.now(), ...props };
  try {
    window.dispatchEvent(new CustomEvent('ob-pwa', { detail }));
  } catch {
    /* ignore */
  }

  const api = analyticsBaseUrl();
  if (!api) return;

  try {
    const blob = new Blob([JSON.stringify(detail)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(`${api}/api/analytics/pwa`, blob);
      if (ok) return;
    }
    fetch(`${api}/api/analytics/pwa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detail),
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
