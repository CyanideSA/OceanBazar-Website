'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunkLoadRecovery';

/**
 * Recovers tabs that sat open across a deploy: Next chunk 404s surface as
 * "Something went wrong" until a full reload. Auto-reload once on those errors.
 */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error || event.message;
      if (isChunkLoadError(err) || isChunkLoadError(event.message)) {
        reloadOnceForChunkError(String(event.message || err));
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnceForChunkError(String(event.reason));
      }
    };

    // Returning from background after a long idle — soft check for stale build id.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const meta = document.querySelector('script[src*="/_next/static/"]') as HTMLScriptElement | null;
        const src = meta?.src || '';
        if (!src) return;
        // Fire-and-forget HEAD; 404 means the old chunk is gone after deploy.
        fetch(src, { method: 'HEAD', cache: 'no-store' })
          .then((res) => {
            if (res.status === 404) reloadOnceForChunkError('stale-next-chunk-404');
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
