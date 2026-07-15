'use client';

import { useTranslations } from 'next-intl';

const METHODS = [
  { id: 'bkash', label: 'bKash', className: 'bg-[#E2136E] text-white' },
  { id: 'nagad', label: 'Nagad', className: 'bg-[#F7941D] text-white' },
  { id: 'rocket', label: 'Rocket', className: 'bg-[#8A2BE2] text-white' },
  { id: 'upay', label: 'Upay', className: 'bg-[#00A651] text-white' },
  { id: 'visa', label: 'VISA', className: 'bg-[#1A1F71] text-white' },
  { id: 'mastercard', label: 'Mastercard', className: 'bg-[#EB001B] text-white' },
] as const;

interface PaymentLogosProps {
  showLabel?: boolean;
}

export default function PaymentLogos({ showLabel = true }: PaymentLogosProps) {
  const t = useTranslations('footer');

  return (
    <div>
      {showLabel && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200/70">{t('payWith')}</p>
      )}
      <div className="flex max-w-full flex-wrap items-center gap-1.5">
        {METHODS.map((m) => (
          <span
            key={m.id}
            className={`inline-flex h-7 min-w-[56px] items-center justify-center rounded px-2 text-[10px] font-bold shadow-sm ${m.className}`}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
