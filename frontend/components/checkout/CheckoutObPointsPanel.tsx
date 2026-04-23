'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Star, X } from 'lucide-react';
import { cartApi, obPointsApi } from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { REDEMPTION_AMOUNTS, REDEMPTION_TABLE } from '@/lib/ob-points';
import type { OBTier } from '@/types';
import { cn } from '@/lib/utils';

export default function CheckoutObPointsPanel() {
  const t = useTranslations('checkout');
  const tp = useTranslations('obPoints');
  const tc = useTranslations('common');
  const { appliedObPoints, setAppliedObPoints } = useCartStore();

  const { data: balanceData } = useQuery({
    queryKey: ['ob-points-balance'],
    queryFn: () => obPointsApi.balance().then((r) => r.data as { balance: number; tier: OBTier }),
  });

  const applyMutation = useMutation({
    mutationFn: (points: number) => cartApi.applyObPoints(points).then((r) => r.data as { points: number; bdtDiscount: number }),
    onSuccess: (data) => setAppliedObPoints({ points: data.points, bdtDiscount: data.bdtDiscount }),
  });

  const tier = balanceData?.tier ?? 'Bronze';
  const balance = balanceData?.balance ?? 0;
  const rates = REDEMPTION_TABLE[tier];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <h2 className="text-lg font-semibold text-foreground">{t('obPointsRedeem')}</h2>
        </div>
        {balanceData && (
          <span className="text-sm text-muted-foreground">
            {tp('balance')}: <strong className="text-foreground">{balance.toLocaleString()} OB</strong>
          </span>
        )}
      </div>

      {appliedObPoints ? (
        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
          <div>
            <p className="font-medium text-foreground">
              {appliedObPoints.points.toLocaleString()} OB → −{tc('taka')}
              {appliedObPoints.bdtDiscount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{t('obAppliedHint')}</p>
          </div>
          <button
            type="button"
            onClick={() => setAppliedObPoints(null)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-destructive"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{tp('selectPackage')}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {REDEMPTION_AMOUNTS.map((pts) => {
              const can = balance >= pts;
              const bdt = rates[pts];
              return (
                <button
                  key={pts}
                  type="button"
                  disabled={!can || applyMutation.isPending}
                  onClick={() => applyMutation.mutate(pts)}
                  className={cn(
                    'rounded-xl border-2 px-3 py-3 text-left text-sm transition-colors',
                    can
                      ? 'border-border hover:border-primary/50 hover:bg-muted/50'
                      : 'cursor-not-allowed border-border opacity-50'
                  )}
                >
                  <p className="font-semibold text-foreground">{pts.toLocaleString()} OB</p>
                  <p className="text-emerald-600 dark:text-emerald-400">
                    −{tc('taka')}
                    {bdt}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
