'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Star } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useOBPointsStore } from '@/stores/obPointsStore';
import { obPointsApi } from '@/lib/api';
import { REDEMPTION_TABLE, REDEMPTION_AMOUNTS } from '@/lib/ob-points';
import { useToast } from '@/hooks/useToast';

export default function RedemptionModal() {
  const t = useTranslations('obPoints');
  const tc = useTranslations('common');
  const { info, isRedeemModalOpen, setRedeemModalOpen, decrementBalance } = useOBPointsStore();
  const [selected, setSelected] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  const { success: toastSuccess, error: toastError } = useToast();

  const redeemMutation = useMutation({
    mutationFn: (points: number) => obPointsApi.redeem(points).then((r) => r.data),
    onSuccess: () => {
      if (selected) decrementBalance(selected);
      setSuccess(true);
      toastSuccess(t('redeemSuccess'));
    },
    onError: () => toastError(tc('error')),
  });

  if (!isRedeemModalOpen || !info) return null;

  const rates = REDEMPTION_TABLE[info.tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setRedeemModalOpen(false)} />

      <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md p-6">
        <button
          onClick={() => { setRedeemModalOpen(false); setSuccess(false); setSelected(null); }}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-foreground mb-2">{t('redeemSuccess')}</h3>
            <p className="text-muted-foreground">
              {selected} OB = {tc('taka')}{rates[selected!]} discount applied
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-xl font-bold text-foreground">{t('redeem')}</h2>
            </div>

            <div className="bg-muted/50 rounded-xl px-4 py-3 mb-6 flex justify-between">
              <span className="text-muted-foreground text-sm">{t('balance')}</span>
              <span className="font-bold text-foreground">{info.balance.toLocaleString()} OB</span>
            </div>

            <p className="text-sm font-medium text-muted-foreground mb-3">{t('selectPackage')}</p>

            <div className="space-y-3 mb-6">
              {REDEMPTION_AMOUNTS.map((pts) => {
                const canRedeem = info.balance >= pts;
                const bdtValue = rates[pts];
                return (
                  <button
                    key={pts}
                    disabled={!canRedeem}
                    onClick={() => setSelected(selected === pts ? null : pts)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      selected === pts
                        ? 'border-primary bg-primary/5'
                        : canRedeem
                        ? 'border-border hover:border-primary/50 cursor-pointer'
                        : 'border-border bg-muted opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-yellow-500">⭐</span>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{pts.toLocaleString()} OB</p>
                        <p className="text-xs text-muted-foreground">{info.tier} tier</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-600">{tc('taka')}{bdtValue}</span>
                  </button>
                );
              })}
            </div>

            <button
              disabled={!selected || redeemMutation.isPending}
              onClick={() => selected && redeemMutation.mutate(selected)}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {redeemMutation.isPending ? tc('loading') : t('redeem')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
