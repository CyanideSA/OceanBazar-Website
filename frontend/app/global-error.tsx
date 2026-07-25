'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/reportClientError';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunkLoadRecovery';

/**
 * Catches errors in the root layout. Must define <html> and <body>.
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error) && reloadOnceForChunkError(error.message)) return;
    reportClientError({
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      snapshot: { boundary: 'global-error' },
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          background: 'linear-gradient(165deg, #020617 0%, #0f172a 45%, #020617 100%)',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <img
          src="/ob-brand-logo.png?v=7"
          alt="OceanBazar"
          width={200}
          height={94}
          style={{ height: 'auto', width: 'min(200px, 70vw)', objectFit: 'contain', marginBottom: '1.5rem' }}
        />
        <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: '#cbd5e1', maxWidth: '26rem', marginBottom: '0.35rem', lineHeight: 1.5 }}>
          Something went wrong, please go back!
        </p>
        <p
          lang="bn"
          style={{
            fontFamily: "'Noto Sans Bengali', system-ui, sans-serif",
            color: '#bae6fd',
            maxWidth: '26rem',
            marginBottom: '1rem',
            lineHeight: 1.55,
          }}
        >
          কিছু ভুল হয়েছে, দয়া করে ফিরে যান!
        </p>
        <p style={{ color: '#94a3b8', maxWidth: '28rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error?.message || 'Oceanbazar hit an unexpected error. Please try again.'}
        </p>
        {error?.digest ? (
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem' }}>
            ID: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: '#0ea5e9',
            color: '#020617',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <a href="/en" style={{ marginTop: '1.25rem', color: '#7dd3fc', fontSize: '0.9rem' }}>
          Back to home (EN)
        </a>
        <a href="/bn" style={{ marginTop: '0.5rem', color: '#7dd3fc', fontSize: '0.9rem' }}>
          হোমে ফিরুন (BN)
        </a>
      </body>
    </html>
  );
}
