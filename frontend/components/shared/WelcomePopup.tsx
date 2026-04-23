'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { X, Gift, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'ob_welcome_dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function WelcomePopup() {
  const t = useTranslations('welcome');
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={dismiss}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className={cn(
          'fixed inset-x-4 top-1/2 z-[101] mx-auto max-w-md -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
          'sm:inset-x-auto sm:w-[420px]',
          'animate-in zoom-in-95 slide-in-from-bottom-4 duration-300',
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Hero gradient banner */}
        <div className="relative flex flex-col items-center bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-6 pb-6 pt-8 text-center text-primary-foreground">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Gift className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold leading-tight sm:text-2xl">{t('title')}</h2>
          <p className="mt-1.5 text-sm opacity-90">{t('subtitle')}</p>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Promo code */}
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

          {/* CTA */}
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
