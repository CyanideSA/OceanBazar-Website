'use client';

import { useTranslations } from 'next-intl';

interface PaymentLogosProps {
  showLabel?: boolean;
}

/**
 * Full-bleed SSLCommerz "Pay With" strip. The source banner is ~30:1
 * (9561x314), so it keeps a fixed legible height and scrolls horizontally
 * on screens narrower than the rendered strip (phone/tablet).
 */
export default function PaymentLogos({ showLabel = true }: PaymentLogosProps) {
  const t = useTranslations('footer');

  return (
    <div className="w-full">
      {showLabel && (
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-blue-200/70">
          {t('payWith')}
        </p>
      )}
      <div className="scrollbar-hide w-full overflow-x-auto bg-white py-2.5 sm:py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sslcommerz-payments.png"
          alt="Pay with SSLCommerz — bKash, Nagad, Upay, VISA, Mastercard, bank cards and more"
          className="mx-auto h-9 w-auto max-w-none sm:h-11 md:h-auto md:w-full md:max-w-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}
