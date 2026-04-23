'use client';

import { useTranslations } from 'next-intl';
import { Info, Lock } from 'lucide-react';
import { COD_LIMIT } from '@/lib/pricing';
import { cn } from '@/lib/utils';

export type PaymentMethodId =
  | 'cod'
  | 'bkash'
  | 'nagad'
  | 'rocket'
  | 'upay'
  | 'sslcommerz'
  | 'installment';

interface MethodDef {
  id: PaymentMethodId;
  labelKey: string;
  sublabelKey?: string;
  badge?: string;
  brandClass: string;
}

const METHODS: MethodDef[] = [
  { id: 'cod', labelKey: 'cod', brandClass: 'bg-emerald-600 text-white', badge: 'COD' },
  { id: 'bkash', labelKey: 'bkash', brandClass: 'bg-[#E2136E] text-white', badge: 'bKash' },
  { id: 'nagad', labelKey: 'nagad', brandClass: 'bg-[#F7941D] text-white', badge: 'Nagad' },
  { id: 'rocket', labelKey: 'rocket', brandClass: 'bg-[#8A2BE2] text-white', badge: 'Rocket' },
  { id: 'upay', labelKey: 'upay', brandClass: 'bg-[#00A651] text-white', badge: 'Upay' },
  { id: 'sslcommerz', labelKey: 'cards', sublabelKey: 'cardsSub', brandClass: 'bg-slate-800 text-white', badge: 'VISA' },
  { id: 'installment', labelKey: 'installment', brandClass: 'bg-muted text-muted-foreground', badge: '—' },
];

interface Props {
  orderTotal: number;
  selected: string;
  onSelect: (method: string) => void;
}

export default function PaymentMethodSelector({ orderTotal, selected, onSelect }: Props) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const codAllowed = orderTotal <= COD_LIMIT;

  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:hidden">
        {METHODS.map((method) => {
          const isCod = method.id === 'cod';
          const isInstallment = method.id === 'installment';
          const isDisabled = (isCod && !codAllowed) || isInstallment;
          const isSelected = selected === method.id;

          return (
            <button
              key={method.id}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(method.id)}
              className={cn(
                'flex w-[140px] shrink-0 flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all',
                isSelected && !isDisabled
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : isDisabled
                    ? 'cursor-not-allowed border-border bg-muted/50 opacity-50'
                    : 'border-border bg-card hover:border-primary/40'
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-full items-center justify-center rounded-lg text-xs font-bold',
                  method.brandClass
                )}
              >
                {method.badge}
              </span>
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold', isDisabled ? 'text-muted-foreground' : 'text-foreground')}>
                  {t(method.labelKey)}
                </p>
                {isCod && !codAllowed && (
                  <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">Max ৳{COD_LIMIT.toLocaleString()}</p>
                )}
              </div>
              {isSelected && !isDisabled && (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop: grid layout */}
      <div className="hidden grid-cols-2 gap-2 sm:grid md:grid-cols-3">
        {METHODS.map((method) => {
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
                className={cn(
                  'flex w-full items-stretch gap-3 rounded-xl border-2 p-3 text-left transition-all min-h-[60px]',
                  isSelected && !isDisabled
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : isDisabled
                      ? 'cursor-not-allowed border-border bg-muted/50 opacity-60'
                      : 'border-border bg-card hover:border-primary/40'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-bold sm:h-12 sm:w-14',
                    method.brandClass
                  )}
                >
                  {method.badge}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('font-semibold', isDisabled ? 'text-muted-foreground' : 'text-foreground')}>
                    {t(method.labelKey)}
                  </p>
                  {method.sublabelKey && (
                    <p className="text-xs text-muted-foreground">{t(method.sublabelKey)}</p>
                  )}
                  {isCod && !codAllowed && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      {t('codDisabledMsg')} ({tc('taka')}
                      {COD_LIMIT.toLocaleString()})
                    </p>
                  )}
                  {isInstallment && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      {t('installmentComingSoon')}
                    </p>
                  )}
                  {method.id === 'sslcommerz' && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Mastercard</p>
                  )}
                </div>
                {isSelected && !isDisabled && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-full bg-primary">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
