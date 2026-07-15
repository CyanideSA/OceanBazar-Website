'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { resolvePublicApiBase } from '@/lib/api';
import { flashDealsPagePath } from '@/lib/flashDeals';
import { cn } from '@/lib/utils';

interface FlashSalePayload {
  id: string;
  name: string;
  ends_at: string;
  banner_color?: string;
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(endsAt: string): TimeLeft {
  const total = Math.max(0, new Date(endsAt).getTime() - Date.now());
  return {
    hours: Math.floor(total / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
    total,
  };
}

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

export default function FlashSaleBanner() {
  const locale = useLocale();
  const t = useTranslations('home.flashDeal');
  const [sale, setSale] = useState<FlashSalePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0, total: 0 });

  const fetchSale = useCallback(async () => {
    try {
      const base = resolvePublicApiBase();
      const res = await fetch(`${base}/api/flash-sales/active?lang=${locale}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setSale(data.sale ?? data.campaigns?.[0]?.sale ?? null);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [locale]);

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

  if (loading || !sale || time.total <= 0) return null;

  const accent = sale.banner_color || '#f97316';
  const shopHref = flashDealsPagePath(locale, sale.id);

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="relative w-full overflow-hidden border-b border-orange-400/40 bg-gradient-to-r from-neutral-950/95 via-orange-950/90 to-neutral-950/95 backdrop-blur-md"
      style={{
        boxShadow: `0 0 32px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      {/* Bottom glow line — only this strip radiates outward */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${accent} 50%, transparent 95%)`,
          boxShadow: `0 0 14px 2px ${accent}88`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(249,115,22,0.18),transparent_70%)]" />

      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 truncate text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white sm:text-left sm:text-xs sm:tracking-[0.2em]">
          <span aria-hidden>🔥</span> {t('title')}
          <span className="mx-2 hidden text-white/25 sm:inline">·</span>
          <span className="hidden font-semibold normal-case tracking-normal text-orange-100/90 sm:inline">
            ⏱ {t('clockTicking')}
          </span>
        </p>

        <InlineCountdown time={time} compact />
        <InlineCountdown time={time} />

        <Link
          href={shopHref}
          className={cn(
            'group relative shrink-0 overflow-hidden rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide sm:px-4 sm:py-2 sm:text-xs',
            'bg-gradient-to-r from-orange-500 to-red-600 text-white',
            'shadow-[0_0_18px_rgba(249,115,22,0.5)] ring-1 ring-orange-300/40',
            'transition-all hover:shadow-[0_0_26px_rgba(249,115,22,0.7)] hover:brightness-110 active:scale-[0.98]',
          )}
        >
          <span className="relative z-10 flex items-center gap-1">
            {t('shopNow')}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
