'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  calcTimeLeft,
  calcTimeUntil,
  type FlashSaleMeta,
  type TimeLeft,
} from '@/lib/flashDeals';

export function CountdownDigits({
  time,
  labels,
}: {
  time: TimeLeft;
  labels: { hrs: string; min: string; sec: string };
}) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex items-end gap-1.5 rounded-xl bg-black/40 px-4 py-2 ring-1 ring-white/10">
      <Digit value={pad(time.hours)} label={labels.hrs} />
      <span className="mb-4 text-lg font-black text-white/50">:</span>
      <Digit value={pad(time.minutes)} label={labels.min} />
      <span className="mb-4 text-lg font-black text-white/50">:</span>
      <Digit value={pad(time.seconds)} label={labels.sec} />
    </div>
  );
}

function Digit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-black/50 font-mono text-lg font-black tabular-nums text-white shadow-inner ring-1 ring-white/20">
        {value}
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">{label}</span>
    </div>
  );
}

export function FlashGlowShell({
  sale,
  children,
  className,
}: {
  sale?: FlashSaleMeta | null;
  children: React.ReactNode;
  className?: string;
}) {
  const accent = sale?.banner_color || '#f97316';
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/20 p-4 sm:p-6',
        'bg-gradient-to-b from-orange-500/15 via-background/70 to-background/50',
        'ring-1 ring-orange-400/25 backdrop-blur-xl',
        className,
      )}
      style={{ boxShadow: `0 0 48px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.12)` }}
    >
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-red-500/15 blur-3xl" />
      {children}
    </div>
  );
}

export function FlashSectionHeader({
  sale,
  title,
  subtitle,
}: {
  sale?: FlashSaleMeta | null;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-orange-400/40 bg-gradient-to-r from-orange-600/90 via-red-500/90 to-orange-600/90 px-4 py-4 text-center shadow-[0_0_24px_rgba(249,115,22,0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.25),transparent_55%)]" />
      <p className="relative text-lg font-black uppercase tracking-[0.2em] text-white drop-shadow sm:text-xl">
        🔥 {title} 🔥
      </p>
      <p className="relative mt-1 text-sm font-semibold text-white/90 sm:text-base">⏱ {subtitle}</p>
      {sale?.banner_text && (
        <p className="relative mt-2 text-xs text-white/80">{sale.banner_text}</p>
      )}
      {sale?.name && (
        <p className="relative mt-1 text-xs font-bold uppercase tracking-widest text-white/70">{sale.name}</p>
      )}
    </div>
  );
}

export function FlashShowMoreButton({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const t = useTranslations('home.flashDeal');
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-orange-400/50 bg-orange-500/15 px-8 py-2.5 text-sm font-bold text-orange-700 shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all hover:bg-orange-500/25 dark:text-orange-100',
        className,
      )}
    >
      {t('showMore')}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function LiveCountdownRow({ endsAt }: { endsAt: string }) {
  const t = useTranslations('home.flashDeal');
  const [time, setTime] = useState(() => calcTimeLeft(endsAt));

  useEffect(() => {
    const tick = () => setTime(calcTimeLeft(endsAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (time.total <= 0) return null;

  return (
    <div className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
      <span className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-300">
        {t('endsIn')}
      </span>
      <CountdownDigits time={time} labels={{ hrs: t('hrs'), min: t('min'), sec: t('sec') }} />
    </div>
  );
}

export function UpcomingCountdownCard({ sale }: { sale: FlashSaleMeta }) {
  const t = useTranslations('flashDealsPage');
  const [time, setTime] = useState(() => calcTimeUntil(sale.starts_at || sale.ends_at));

  useEffect(() => {
    if (!sale.starts_at) return;
    const tick = () => setTime(calcTimeUntil(sale.starts_at!));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sale.starts_at]);

  const accent = sale.banner_color || '#f97316';

  return (
    <div
      className="rounded-2xl border border-white/15 bg-black/30 p-5 backdrop-blur-md"
      style={{ boxShadow: `0 0 24px ${accent}33` }}
    >
      <p className="text-lg font-bold text-white">{sale.name}</p>
      {sale.banner_text && <p className="mt-1 text-sm text-white/75">{sale.banner_text}</p>}
      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-orange-300">{t('startsIn')}</p>
      <p className="mt-2 font-mono text-2xl font-black tabular-nums text-white">
        {String(time.days).padStart(2, '0')}d {String(time.hours).padStart(2, '0')}:
        {String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
      </p>
    </div>
  );
}
