'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { reportClientError } from '@/lib/reportClientError';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: Props) {
  const locale = useLocale();
  const t = useTranslations('status.oops');

  useEffect(() => {
    console.error('[Error boundary]', error);
    reportClientError({
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      locale,
      snapshot: { boundary: 'shop-error' },
    });
  }, [error, locale]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6">
        <Logo width={160} height={75} interaction="brand" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">{t('title')}</h1>
      <p className="mb-2 max-w-md text-base text-muted-foreground sm:text-lg">{t('lineEn')}</p>
      <p lang="bn" className="font-bengali mb-6 max-w-md text-base text-muted-foreground sm:text-lg">
        {t('lineBn')}
      </p>

      {error?.digest && (
        <p className="mb-4 rounded-lg bg-muted px-4 py-2 font-mono text-xs text-muted-foreground">
          {t('reference')}: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:brightness-110"
        >
          <RefreshCw className="h-4 w-4" />
          {t('tryAgain')}
        </button>
        <Link
          href={`/${locale}/something-went-wrong${error?.digest ? `?code=${encodeURIComponent(error.digest)}` : ''}`}
          className="rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Details
        </Link>
        <Link
          href={`/${locale}`}
          className="rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {t('ctaHome')}
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href={`/${locale}/tickets`} className="text-primary hover:underline">
          {t('ctaSupport')}
        </Link>
      </p>
    </div>
  );
}
