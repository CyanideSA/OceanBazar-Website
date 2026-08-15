'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useOBPointsStore } from '@/stores/obPointsStore';
import { obPointsApi } from '@/lib/api';
import { TIER_COLORS, TIER_THRESHOLDS, getNextTierInfo } from '@/lib/ob-points';
import TierBadge from './TierBadge';

interface Props {
  compact?: boolean;
}

export default function OBPointsWidget({ compact = false }: Props) {
  const t = useTranslations('obPoints');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { info, setInfo } = useOBPointsStore();

  const { data } = useQuery({
    queryKey: ['ob-points-balance'],
    queryFn: () => obPointsApi.balance().then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (data) setInfo(data);
  }, [data, setInfo]);

  if (!info) {
    return (
      <div className="bg-muted rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
        <div className="h-8 bg-muted-foreground/20 rounded w-1/3" />
      </div>
    );
  }

  const nextTierInfo = getNextTierInfo(info.lifetimeSpend);
  const colors = TIER_COLORS[info.tier];
  const checkoutHref = `/${locale}/checkout`;

  if (compact) {
    return (
      <Link
        href={checkoutHref}
        className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 hover:shadow-sm transition-shadow"
      >
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="text-sm font-semibold text-foreground">{info.balance.toLocaleString()} OB</span>
        <TierBadge tier={info.tier} small />
      </Link>
    );
  }

  const tierFloor =
    info.tier === 'Gold'
      ? TIER_THRESHOLDS.Gold
      : info.tier === 'Silver'
        ? TIER_THRESHOLDS.Silver
        : TIER_THRESHOLDS.Bronze;
  const progress = nextTierInfo
    ? Math.min(100, ((info.lifetimeSpend - tierFloor) / nextTierInfo.remaining) * 100)
    : 100;

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-2xl p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          <h3 className="font-semibold text-foreground">{t('title')}</h3>
        </div>
        <TierBadge tier={info.tier} />
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-1">{t('balance')}</p>
        <p className="text-4xl font-bold text-foreground">{info.balance.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">OB Points</p>
      </div>

      <div className="text-xs text-muted-foreground bg-background/60 rounded-lg px-3 py-2">
        {t('earn')}
      </div>
      <p className="text-xs text-muted-foreground">{t('redeemAtCheckout')}</p>

      {nextTierInfo && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{t('nextTier')}: {nextTierInfo.nextTier}</span>
            <span>{tc('taka')}{nextTierInfo.remaining.toLocaleString()} {t('lifetimeSpend')}</span>
          </div>
          <div className="h-2 bg-background/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <Link
        href={checkoutHref}
        className="block w-full py-2.5 text-center bg-background/80 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent transition-colors"
      >
        {t('redeemAtCheckoutCta')}
      </Link>
    </div>
  );
}
