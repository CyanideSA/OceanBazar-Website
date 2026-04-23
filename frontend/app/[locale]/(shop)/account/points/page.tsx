'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Award, ChevronLeft, Coins, Gift, ShoppingBag, Star, Truck,
  Zap, Users, MessageSquare, Crown, Shield, Sparkles, TrendingUp,
} from 'lucide-react';
import { obPointsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

const TIER_CONFIG = [
  { key: 'bronze', color: 'from-amber-700 to-amber-500', icon: Shield, ring: 'ring-amber-400/30' },
  { key: 'silver', color: 'from-slate-400 to-slate-300', icon: Award, ring: 'ring-slate-300/30' },
  { key: 'gold', color: 'from-yellow-500 to-amber-300', icon: Crown, ring: 'ring-yellow-400/40' },
] as const;

const PERKS_BY_TIER: Record<string, boolean[]> = {
  bronze:  [true,  false, false, false],
  silver:  [true,  true,  false, false],
  gold:    [true,  true,  true,  true],
};

export default function AccountPointsPage() {
  const locale = useLocale();
  const t = useTranslations('obPoints');
  const tc = useTranslations('common');
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ob-points-balance'],
    queryFn: () => obPointsApi.balance().then((r) => r.data as { balance: number; tier: string; lifetimeSpend: number }),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground/30" />
        <p className="text-lg font-semibold text-foreground">{t('loginRequired')}</p>
        <Link href={`/${locale}/auth/login`} className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110">
          {tc('back')}
        </Link>
      </div>
    );
  }

  const tier = (data?.tier ?? 'bronze').toLowerCase();
  const tierIdx = ['bronze', 'silver', 'gold'].indexOf(tier);
  const activeTier = TIER_CONFIG[Math.max(0, tierIdx)];
  const perkKeys = ['perkDiscount', 'perkFreeShipping', 'perkEarlyAccess', 'perkPrioritySupport'] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Back + title */}
      <div className="mb-8 flex items-center gap-3">
        <Link href={`/${locale}/account`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('title')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{t('subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 py-14 text-center">
          <p className="font-semibold text-foreground">{tc('error')}</p>
          <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-primary hover:underline">{tc('retry')}</button>
        </div>
      ) : (
        <>
          {/* ── Hero Balance Row ── */}
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {/* Balance card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-6 shadow-sm">
              <Sparkles className="absolute -right-3 -top-3 h-20 w-20 text-primary/10" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary/70">
                  <Coins className="h-3.5 w-3.5" />
                  {t('balance')}
                </div>
                <p className="mt-3 text-4xl font-extrabold tabular-nums text-primary">{(data?.balance ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">OB Points</p>
              </div>
            </div>

            {/* Tier card */}
            <div className={cn('relative overflow-hidden rounded-2xl border border-border p-6 shadow-sm ring-4', activeTier.ring)}>
              <div className={cn('absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br opacity-20', activeTier.color)} />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <activeTier.icon className="h-3.5 w-3.5" />
                  {t('tier')}
                </div>
                <p className="mt-3 text-3xl font-bold capitalize text-foreground">{t(tier as any)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`tierThresholds.${tier}` as any)}</p>
              </div>
            </div>

            {/* Lifetime spend card */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                {t('lifetimeSpend')}
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">{tc('taka')}{(data?.lifetimeSpend ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('earn')}</p>
            </div>
          </div>

          {/* ── How to Earn ── */}
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              {t('howToEarn')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { key: 'earnShop', descKey: 'earnShopDesc', Icon: ShoppingBag, accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                { key: 'earnReview', descKey: 'earnReviewDesc', Icon: Star, accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                { key: 'earnRefer', descKey: 'earnReferDesc', Icon: Users, accent: 'bg-green-500/10 text-green-600 dark:text-green-400' },
              ] as const).map((item) => (
                <div key={item.key} className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.accent)}>
                    <item.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t(item.key)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(item.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Tier Comparison ── */}
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <Gift className="h-5 w-5 text-primary" />
              {t('tierPerks')}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">&nbsp;</th>
                      {TIER_CONFIG.map((tc2) => (
                        <th key={tc2.key} className={cn('px-4 py-3 text-center text-xs font-bold uppercase tracking-wider', tier === tc2.key ? 'text-primary' : 'text-muted-foreground')}>
                          <div className="flex flex-col items-center gap-1">
                            <tc2.icon className="h-4 w-4" />
                            {t(tc2.key)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perkKeys.map((perk, pi) => (
                      <tr key={perk} className={cn('border-b border-border/50 last:border-0', pi % 2 === 0 && 'bg-muted/20')}>
                        <td className="px-4 py-3 font-medium text-foreground">{t(perk)}</td>
                        {(['bronze', 'silver', 'gold'] as const).map((tk) => (
                          <td key={tk} className="px-4 py-3 text-center">
                            {PERKS_BY_TIER[tk][pi]
                              ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">✓</span>
                              : <span className="text-muted-foreground/40">—</span>
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-muted/30">
                      <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{t('lifetimeSpend')}</td>
                      {(['bronze', 'silver', 'gold'] as const).map((tk) => (
                        <td key={tk} className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {t(`tierThresholds.${tk}`)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
