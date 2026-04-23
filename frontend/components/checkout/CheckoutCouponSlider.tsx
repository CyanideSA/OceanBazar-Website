'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';
import { api } from '@/lib/api';

interface Coupon {
  id: number;
  code: string;
  type: string;
  value: number;
  minOrder: number | null;
  expiresAt: string | null;
}

interface Props {
  onPickCode?: (code: string) => void;
}

export default function CheckoutCouponSlider({ onPickCode }: Props) {
  const t = useTranslations('checkout');

  const { data } = useQuery({
    queryKey: ['storefront-coupons'],
    queryFn: () => api.get('/storefront/coupons').then((r) => r.data as { coupons: Coupon[] }),
    staleTime: 60_000,
  });

  const coupons = data?.coupons ?? [];

  if (coupons.length === 0) return null;

  function descLabel(c: Coupon): string {
    if (c.type === 'percent') return `${c.value}% off`;
    if (c.type === 'fixed') return `৳${c.value} off`;
    if (c.type === 'free_shipping') return 'Free shipping';
    return `${c.value} off`;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted/30 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Tag className="h-4 w-4 text-primary" />
        {t('couponSliderTitle')}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {coupons.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPickCode?.(c.code)}
            className="min-w-[200px] shrink-0 rounded-xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/10 to-transparent px-4 py-3 text-left transition-colors hover:border-primary"
          >
            <p className="font-mono text-sm font-bold text-primary">{c.code}</p>
            <p className="text-xs text-muted-foreground">{descLabel(c)}</p>
            {c.minOrder && c.minOrder > 0 && (
              <p className="mt-0.5 text-2xs text-muted-foreground/70">Min order ৳{c.minOrder}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
