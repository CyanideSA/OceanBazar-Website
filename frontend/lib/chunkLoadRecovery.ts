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

/**
 * One automatic hard navigation per minute.
 * Soft `location.reload()` often reuses a broken document/runtime on iOS 15;
 * replace + cache-bust forces a fresh HTML shell and chunk map.
 */
export function reloadOnceForChunkError(reason: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* private mode — still try reload */
  }

  // #region agent log
  debugSessionLog({
    hypothesisId: 'H4',
    location: 'chunkLoadRecovery.ts:reloadOnce',
    message: 'hard cache-bust recovery for chunk error',
    data: { reason: String(reason || '').slice(0, 220), runId: 'post-fix' },
    runId: 'post-fix',
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
    const url = new URL(window.location.href);
    url.searchParams.set('_obcb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
}
