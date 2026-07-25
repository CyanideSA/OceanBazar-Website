import { debugSessionLog } from '@/lib/debugSessionLog';

/** Detect Next.js / webpack failures common after a deploy while a tab sits in the background. */
export function isChunkLoadError(error: unknown): boolean {
  const msg = String(
    (error as { message?: string })?.message ||
      (error as { name?: string })?.name ||
      error ||
      '',
  ).toLowerCase();
  return (
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    // Stale Server Action hashes after deploy — client UI can go blank until hard reload.
    msg.includes('failed to find server action') ||
    (msg.includes('server action') && msg.includes('older or newer deployment'))
  );
}

const RELOAD_KEY = 'ob_chunk_reload_v2';

/**
 * At most ONE automatic recovery per browser profile (localStorage).
 * Previous sessionStorage + visibility HEAD reloads caused a storefront ↔
 * "Something went wrong" loop on iPhone 7 / Pixel 4 when a deploy removed
 * still-referenced chunk URLs (and 404s were cached as immutable).
 */
export function reloadOnceForChunkError(reason: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (localStorage.getItem(RELOAD_KEY) === '1') {
      // #region agent log
      debugSessionLog({
        hypothesisId: 'H9',
        location: 'chunkLoadRecovery.ts:reloadOnce',
        message: 'skip recovery — already attempted once',
        data: { reason: String(reason || '').slice(0, 220) },
        runId: 'post-fix-noloop',
      });
      // #endregion
      return false;
    }
    localStorage.setItem(RELOAD_KEY, '1');
  } catch {
    // Private mode: never auto-reload — that path looped forever.
    // #region agent log
    debugSessionLog({
      hypothesisId: 'H9',
      location: 'chunkLoadRecovery.ts:reloadOnce',
      message: 'skip recovery — storage unavailable',
      data: { reason: String(reason || '').slice(0, 220) },
      runId: 'post-test-noloop',
    });
    // #endregion
    return false;
  }

  // #region agent log
  debugSessionLog({
    hypothesisId: 'H9',
    location: 'chunkLoadRecovery.ts:reloadOnce',
    message: 'single hard recovery for chunk error',
    data: { reason: String(reason || '').slice(0, 220) },
    runId: 'post-test-noloop',
  });
  // #endregion

  try {
    void caches?.keys?.().then((keys) => {
      for (const k of keys) {
        if (k.startsWith('ob-cache')) void caches.delete(k);
      }
    });
  } catch {
    /* ignore */
  }

  try {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('_obcb');
    url.searchParams.set('_obcb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
}
