'use client';

import { useTranslations } from 'next-intl';
import { Info, CreditCard, Truck } from 'lucide-react';
import { COD_LIMIT } from '@/lib/pricing';
import { cn } from '@/lib/utils';

export type PaymentMethodId = 'sslcommerz' | 'cod';

interface Props {
  orderTotal: number;
  selected: string;
  onSelect: (method: string) => void;
}

export default function PaymentMethodSelector({ orderTotal, selected, onSelect }: Props) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const codAllowed = orderTotal <= COD_LIMIT;

  const options: Array<{
    id: PaymentMethodId;
    label: string;
    sublabel: string;
    icon: typeof CreditCard;
    disabled: boolean;
  }> = [
    {
      id: 'sslcommerz',
      label: t('payNow'),
      sublabel: t('payNowSub'),
      icon: CreditCard,
      disabled: false,
    },
    {
      id: 'cod',
      label: t('payLater'),
      sublabel: t('payLaterSub'),
      icon: Truck,
      disabled: !codAllowed,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selected === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            onClick={() => !option.disabled && onSelect(option.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all min-h-[76px]',
              isSelected && !option.disabled
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : option.disabled
                  ? 'cursor-not-allowed border-border bg-muted/50 opacity-60'
                  : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                option.id === 'sslcommerz' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600',
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block font-semibold', option.disabled ? 'text-muted-foreground' : 'text-foreground')}>
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.sublabel}</span>
              {option.id === 'sslcommerz' && (
                <span className="mt-2 block rounded-md bg-white p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/sslcommerz-pay-now.jpg?v=1"
                    alt="Pay with SSLCommerz — cards, bKash, Nagad, Upay, bank payments and more"
                    className="h-auto w-full object-contain"
                    loading="lazy"
                  />
                </span>
              )}
              {option.id === 'cod' && !codAllowed && (
                <span className="mt-1 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  {t('codDisabledMsg')} {tc('taka')}{COD_LIMIT.toLocaleString()}
                </span>
              )}
            </span>
            {isSelected && !option.disabled && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-full bg-primary">
                <span className="h-2 w-2 rounded-full bg-primary-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
