'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunkLoadRecovery';
import { debugSessionLog } from '@/lib/debugSessionLog';

/**
 * Recovers tabs that sat open across a deploy: Next chunk 404s surface as
 * "Something went wrong" until a full reload. Auto-reload at most once.
 * Does NOT poll script HEAD on visibility — that re-triggered reload loops.
 */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error || event.message;
      // #region agent log
      debugSessionLog({
        hypothesisId: 'H9',
        location: 'ChunkLoadRecovery.tsx:window-error',
        message: 'window error',
        data: {
          msg: String(event.message || '').slice(0, 200),
          filename: String(event.filename || '').slice(0, 120),
          chunk: isChunkLoadError(err) || isChunkLoadError(event.message),
        },
        runId: 'post-test-noloop',
      });
      // #endregion
      if (isChunkLoadError(err) || isChunkLoadError(event.message)) {
        reloadOnceForChunkError(String(event.message || err));
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      // #region agent log
      debugSessionLog({
        hypothesisId: 'H9',
        location: 'ChunkLoadRecovery.tsx:unhandledrejection',
        message: 'unhandledrejection',
        data: {
          reason: String(event.reason || '').slice(0, 200),
          chunk: isChunkLoadError(event.reason),
        },
        runId: 'post-test-noloop',
      });
      // #endregion
      if (isChunkLoadError(event.reason)) {
        reloadOnceForChunkError(String(event.reason));
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
