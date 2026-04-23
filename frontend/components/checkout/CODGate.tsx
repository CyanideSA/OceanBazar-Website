'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Info } from 'lucide-react';
import { COD_LIMIT } from '@/lib/pricing';

interface Props {
  orderTotal: number;
  selected: string;
  onSelect: (method: string) => void;
}

const PAYMENT_METHODS = [
  { id: 'cod', labelKey: 'cod', icon: '💵' },
  { id: 'bkash', labelKey: 'bkash', icon: '📱' },
  { id: 'nagad', labelKey: 'nagad', icon: '📲' },
  { id: 'sslcommerz', labelKey: 'sslcommerz', icon: '💳' },
  { id: 'installment', labelKey: 'installment', icon: '📅' },
] as const;

export default function CODGate({ orderTotal, selected, onSelect }: Props) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const codAllowed = orderTotal <= COD_LIMIT;

  return (
    <div className="space-y-3">
      {PAYMENT_METHODS.map((method) => {
        const isCod = method.id === 'cod';
        const isInstallment = method.id === 'installment';
        const isDisabled = (isCod && !codAllowed) || isInstallment;
        const isSelected = selected === method.id;

        return (
          <div key={method.id} className="relative">
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(method.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                isSelected && !isDisabled
                  ? 'border-primary bg-primary/5'
                  : isDisabled
                  ? 'border-border bg-muted cursor-not-allowed opacity-60'
                  : 'border-border hover:border-primary/40 cursor-pointer'
              }`}
            >
              <span className="text-2xl">{method.icon}</span>
              <div className="flex-1">
                <p className={`font-medium ${isDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {t(method.labelKey)}
                </p>
                {isCod && !codAllowed && (
                  <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {t('codDisabledMsg')} ({tc('taka')}{COD_LIMIT.toLocaleString()})
                  </p>
                )}
                {isInstallment && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t('installmentComingSoon')}</p>
                )}
              </div>
              {isSelected && !isDisabled && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
