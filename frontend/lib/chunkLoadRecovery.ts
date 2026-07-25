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

const RELOAD_KEY = 'ob_chunk_reload_at';
const RELOAD_COUNT_KEY = 'ob_chunk_reload_n';

/**
 * One automatic hard navigation per minute (up to 2 per tab session).
 * Soft `location.reload()` often reuses a broken document/runtime on iOS 15;
 * replace + cache-bust forces a fresh HTML shell and chunk map.
 * After a deploy that changes chunk hashes, the first recovery should land on
 * new URLs; a second attempt covers a race with a mid-deploy HTML shell.
 */
export function reloadOnceForChunkError(reason: string): boolean {
  if (typeof window === 'undefined') return false;
  let count = 0;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    count = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || 0);
    if (count >= 2) return false;
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  } catch {
    /* private mode — still try reload */
  }

  // #region agent log
  debugSessionLog({
    hypothesisId: 'H8',
    location: 'chunkLoadRecovery.ts:reloadOnce',
    message: 'hard cache-bust recovery for chunk error',
    data: {
      reason: String(reason || '').slice(0, 220),
      attempt: count + 1,
      runId: 'post-fix-hashsalt',
    },
    runId: 'post-fix-hashsalt',
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
    url.searchParams.set('_obcb', String(Date.now()));
    // Drop prior bust params that can accumulate
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
}
