'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { resolvePublicApiBase } from '@/lib/api';
import {
  calcTimeLeft,
  flashDealsPagePath,
  type FlashSaleMeta,
  type TimeLeft,
} from '@/lib/flashDeals';
import { cn } from '@/lib/utils';
import { AB_TESTS, useAbVariant } from '@/lib/abTest';

function InlineCountdown({ time, compact }: { time: TimeLeft; compact?: boolean }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (compact) {
    return (
      <span className="font-mono text-[10px] font-bold tabular-nums text-orange-200 sm:hidden">
        {pad(time.hours)}:{pad(time.minutes)}:{pad(time.seconds)}
      </span>
    );
  }
  return (
    <div className="hidden shrink-0 items-center gap-0.5 rounded-md bg-black/40 px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-white ring-1 ring-white/10 sm:flex">
      <span>{pad(time.hours)}</span>
      <span className="text-orange-400/70">:</span>
      <span>{pad(time.minutes)}</span>
      <span className="text-orange-400/70">:</span>
      <span>{pad(time.seconds)}</span>
    </div>
  );
}

export default function FlashSaleBanner({ initialSale }: { initialSale?: FlashSaleMeta | null }) {
  const locale = useLocale();
  const t = useTranslations('home.flashDeal');
  const urgencyVariant = useAbVariant(AB_TESTS.FLASH_URGENCY);
  const [sale, setSale] = useState<FlashSaleMeta | null>(initialSale ?? null);
  const [time, setTime] = useState<TimeLeft>(() =>
    initialSale?.ends_at ? calcTimeLeft(initialSale.ends_at) : { hours: 0, minutes: 0, seconds: 0, total: 0 },
  );

  const fetchSale = useCallback(async () => {
    try {
      const base = resolvePublicApiBase();
      const res = await fetch(`${base}/api/flash-sales/active?lang=${locale}`, { cache: 'no-store' });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const next = (data.sale ?? data.campaigns?.[0]?.sale ?? null) as FlashSaleMeta | null;
      setSale(next);
    } catch (err) {
    }
  }, [locale, initialSale?.id]);

  useEffect(() => {
    fetchSale();
    const id = setInterval(fetchSale, 60_000);
    return () => clearInterval(id);
  }, [fetchSale]);

  useEffect(() => {
    if (!sale?.ends_at) return;
    const tick = () => setTime(calcTimeLeft(sale.ends_at));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sale?.ends_at]);

  // Keep showing when SSR provided a sale even before the client refetch finishes.
  if (!sale || time.total <= 0) return null;

  const accent = sale.banner_color || '#f97316';
  const shopHref = flashDealsPagePath(locale, sale.id);

  return (
    <div
      role="region"
      aria-label={t('title')}
      data-ob-flash-bar="1"
      className="relative w-full overflow-hidden border-b border-orange-500/50"
      style={{
        // Solid colors — avoid backdrop-blur / translucent gradients that paint blank on iOS 12.
        backgroundColor: '#1c0a05',
        backgroundImage: `linear-gradient(90deg, #0a0a0a 0%, ${accent}33 50%, #0a0a0a 100%)`,
        boxShadow: `0 1px 0 ${accent}66`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${accent} 50%, transparent 95%)`,
        }}
      />

      <div className="relative mx-auto flex w-full items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 lg:px-[0.5in]">
        <p className="min-w-0 flex-1 truncate text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white sm:text-left sm:text-xs sm:tracking-[0.2em]">
          <span aria-hidden>🔥</span> {t('title')}
          <span className="mx-2 hidden text-white/25 sm:inline">·</span>
          <span className="hidden font-semibold normal-case tracking-normal text-orange-100/90 sm:inline">
            {urgencyVariant === 'B' ? '⚡ Limited units · selling fast' : `⏱ ${t('clockTicking')}`}
          </span>
        </p>

        <InlineCountdown time={time} compact />
        <InlineCountdown time={time} />

        <Link
          href={shopHref}
          data-no-nav-loading="true"
          className={cn(
            'group relative shrink-0 overflow-hidden rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide sm:px-4 sm:py-2 sm:text-xs',
            'text-white',
          )}
          style={{
            backgroundImage: 'linear-gradient(90deg, #f97316, #dc2626)',
            boxShadow: '0 0 12px rgba(249,115,22,0.45)',
          }}
        >
          <span className="relative z-10 flex items-center gap-1">
            {urgencyVariant === 'B' ? 'Claim deal' : t('shopNow')}
            <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>
    </div>
  );
}
