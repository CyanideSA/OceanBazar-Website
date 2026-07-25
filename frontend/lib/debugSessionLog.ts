/**
 * Debug-session logger (session 078c95).
 * Dual-writes: Cursor ingest (local) + BFF client-errors (reachable from iPhone on prod).
 */
type DebugPayload = {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
};

function apiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function debugSessionLog(payload: DebugPayload): void {
  if (typeof window === 'undefined') return;

  const body = {
    sessionId: '078c95',
    runId: payload.runId ?? 'iphone7-repro',
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: {
      ...(payload.data ?? {}),
      href: window.location.href,
      path: window.location.pathname,
      ua: navigator.userAgent.slice(0, 180),
      vw: window.innerWidth,
      vh: window.innerHeight,
    },
    timestamp: Date.now(),
  };

  // #region agent log
  fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '078c95' },
    body: JSON.stringify(body),
  }).catch(() => {});
  // #endregion

  // Production/iPhone path — localhost ingest is unreachable on device
  try {
    const endpoint = `${apiBase()}/api/client-errors`;
    const remote = JSON.stringify({
      message: `[debug-078c95] ${payload.message}`,
      url: window.location.href,
      userAgent: navigator.userAgent,
      snapshot: body,
    });
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(endpoint, new Blob([remote], { type: 'application/json' }));
      if (ok) return;
    }
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: remote,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
