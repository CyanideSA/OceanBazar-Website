'use client';

import { getUserFromToken } from '@/lib/auth';

type ClientErrorPayload = {
  digest?: string;
  message?: string;
  stack?: string;
  url?: string;
  locale?: string;
  snapshot?: Record<string, unknown>;
};

let lastSentKey = '';
let lastSentAt = 0;

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

function buildSnapshot(extra?: Record<string, unknown>): Record<string, unknown> {
  if (typeof window === 'undefined') return extra ?? {};
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer || undefined,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    language: navigator.language,
    platform: navigator.platform,
    online: navigator.onLine,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

/** Fire-and-forget error snapshot to BFF → admin CRM */
export function reportClientError(payload: ClientErrorPayload): void {
  if (typeof window === 'undefined') return;

  const key = `${payload.digest ?? ''}|${payload.message ?? ''}|${payload.url ?? window.location.href}`;
  const now = Date.now();
  if (key === lastSentKey && now - lastSentAt < 15000) return;
  lastSentKey = key;
  lastSentAt = now;

  // JWT payload carries userId/user_id claims, not the full User shape.
  const tokenUser = getUserFromToken() as { userId?: string; user_id?: string; id?: string } | null;
  const userId = tokenUser?.userId ?? tokenUser?.user_id ?? tokenUser?.id;

  const body = JSON.stringify({
    digest: payload.digest,
    message: payload.message,
    stack: payload.stack,
    url: payload.url ?? window.location.href,
    locale: payload.locale,
    userAgent: navigator.userAgent,
    userId: userId ?? undefined,
    snapshot: buildSnapshot(payload.snapshot),
  });

  const endpoint = `${apiBase()}/api/client-errors`;

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
  } catch {
    /* fall through to fetch */
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}
