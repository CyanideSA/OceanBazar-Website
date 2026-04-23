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

export default function PaymentLogos() {
  const t = useTranslations('footer');

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('payWith')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {METHODS.map((m) => (
          <span
            key={m.id}
            className={`inline-flex min-h-[32px] min-w-[72px] items-center justify-center rounded-md px-3 py-1.5 text-xs font-bold shadow-sm ${m.className}`}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
