'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Logo from '@/components/shared/Logo';
import ObStatusShell from '@/components/status/ObStatusShell';
import { reportClientError } from '@/lib/reportClientError';

export default function SomethingWentWrongClient() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('status.oops');
  const searchParams = useSearchParams();
  const code = searchParams.get('code')?.slice(0, 64);

  useEffect(() => {
    reportClientError({
      digest: code,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      locale,
      snapshot: { boundary: 'something-went-wrong', code: code ?? null },
    });
  }, [code, locale]);

  return (
    <ObStatusShell>
      <div className="flex w-full max-w-xl flex-col items-center">
        <div className="relative drop-shadow-[0_12px_40px_rgba(56,189,248,0.2)]">
          <Logo width={200} height={94} priority interaction="none" />
        </div>

        <div className="mt-9 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-6 py-8 shadow-2xl shadow-sky-900/25 backdrop-blur-xl sm:px-10 sm:py-10">
          <p className="text-center text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
            {t('lineEn')}
          </p>
          <div className="mx-auto my-5 h-px w-16 bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
          <p lang="bn" className="font-bengali text-center text-lg leading-relaxed text-sky-100/95 sm:text-xl">
            {t('lineBn')}
          </p>

          {code ? (
            <p className="mt-6 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-xs text-slate-400">
              {t('reference')}: {code}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:w-auto"
            >
              {t('ctaBack')}
            </button>
            <Link
              href={`/${locale}`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] sm:w-auto"
            >
              {t('ctaHome')}
            </Link>
            <Link
              href={`/${locale}/products`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-transparent px-6 py-3 text-sm font-semibold text-sky-300 underline-offset-4 hover:text-sky-200 hover:underline sm:w-auto"
            >
              {t('ctaProducts')}
            </Link>
          </div>

          <p className="mt-6 text-center">
            <Link href={`/${locale}/tickets`} className="text-sm font-medium text-sky-400/90 hover:text-sky-300 hover:underline">
              {t('ctaSupport')}
            </Link>
          </p>
        </div>
      </div>
    </ObStatusShell>
  );
}
