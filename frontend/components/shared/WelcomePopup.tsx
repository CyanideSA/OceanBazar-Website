'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'ob_welcome_dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const WELCOME_BANNER = '/welcome-popup-banner.png?v=5';

export default function WelcomePopup() {
  const t = useTranslations('welcome');
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_DISABLE_POPUPS === '1') return;
    if (typeof window !== 'undefined' && window.localStorage.getItem('ob_e2e_disable_popups') === '1') return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION_MS) return;
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={dismiss}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className={cn(
          'fixed left-1/2 top-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-300 ease-out',
        )}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative bg-card">
          <Image
            src={WELCOME_BANNER}
            alt={t('title')}
            width={1024}
            height={576}
            priority
            unoptimized
            className="h-auto w-full object-contain"
          />
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('promoLabel')}</p>
              <p className="text-lg font-bold tracking-wider text-primary">WELCOME10</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {t('discount')}
            </span>
          </div>

          <p className="text-center text-xs text-muted-foreground">{t('hint')}</p>

          <Link
            href={`/${locale}/products`}
            onClick={dismiss}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground',
              'shadow-soft transition-all hover:brightness-110 active:scale-[0.98]',
            )}
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={dismiss}
            className="w-full py-1 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {t('dismiss')}
          </button>
        </div>
      </div>
    </>
  );
}
