'use client';

import { useTranslations } from 'next-intl';

interface PaymentLogosProps {
  showLabel?: boolean;
}

/**
 * Full-bleed SSLCommerz "Pay With" strip (official merchant banner).
 * Falls back gracefully if the asset fails to load.
 */
export default function PaymentLogos({ showLabel = true }: PaymentLogosProps) {
  const t = useTranslations('footer');

  return (
    <div className="w-full" data-ob-pay-with="1">
      {showLabel && (
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-blue-200/70">
          {t('payWith')}
        </p>
      )}
      <div className="w-full overflow-x-auto px-3 py-2.5 sm:px-4 sm:py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sslcommerz-pay-with.png?v=4"
          alt="Pay with SSLCommerz — cards, bKash, Nagad, Upay, bank payments and more"
          className="mx-auto block h-auto w-full max-w-[1100px] object-contain bg-transparent"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
