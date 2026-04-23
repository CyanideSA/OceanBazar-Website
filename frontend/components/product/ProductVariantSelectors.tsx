'use client';

import { useTranslations } from 'next-intl';
import type { ProductVariant } from '@/types';
import { uniqueVariantOptions } from '@/lib/variants';
import { cn } from '@/lib/utils';

interface Props {
  variants: ProductVariant[];
  selectedColorSlug: string | null;
  selectedSize: string | null;
  onColor: (slug: string | null) => void;
  onSize: (size: string | null) => void;
  onReset: () => void;
}

export default function ProductVariantSelectors({
  variants,
  selectedColorSlug,
  selectedSize,
  onColor,
  onSize,
  onReset,
}: Props) {
  const t = useTranslations('productDetail');
  const { colors, sizes } = uniqueVariantOptions(variants);
  const hasFilters = colors.length > 0 || sizes.length > 0;

  if (!hasFilters) return null;

  /* Shared chip class builder */
  const chipBase = 'inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors';
  const chipActive = 'border-primary bg-primary/10 text-primary';
  const chipIdle   = 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground';

  const sizeChipBase = 'inline-flex min-h-[40px] shrink-0 items-center rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors';

  return (
    <div className="space-y-4">
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('color')}</p>
          {/* scrollable row — no wrap so chips don't stack on xs */}
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => onColor(null)}
              className={cn(chipBase, !selectedColorSlug ? chipActive : chipIdle)}
            >
              {t('all')}
            </button>
            {colors.map(({ slug, label }) => (
              <button
                key={slug}
                type="button"
                onClick={() => onColor(slug)}
                className={cn(chipBase, selectedColorSlug === slug ? chipActive : chipIdle)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('size')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => onSize(null)}
              className={cn(sizeChipBase, !selectedSize ? chipActive : chipIdle)}
            >
              {t('all')}
            </button>
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSize(s)}
                className={cn(sizeChipBase, selectedSize === s ? chipActive : chipIdle)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {(selectedColorSlug || selectedSize) && (
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('resetVariants')}
        </button>
      )}
    </div>
  );
}
