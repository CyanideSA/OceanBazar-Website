'use client';

import { useTranslations } from 'next-intl';
import type { ProductVariant } from '@/types';
import { uniqueVariantOptions } from '@/lib/variants';
import { cn } from '@/lib/utils';

interface Props {
  variants: ProductVariant[];
  selectedColorSlug: string | null;
  selectedSize: string | null;
  selectedStyle: string | null;
  onColor: (slug: string | null) => void;
  onSize: (size: string | null) => void;
  onStyle: (style: string | null) => void;
  onReset: () => void;
}

export default function ProductVariantSelectors({
  variants,
  selectedColorSlug,
  selectedSize,
  selectedStyle,
  onColor,
  onSize,
  onStyle,
  onReset,
}: Props) {
  const t = useTranslations('productDetail');
  const { colors, sizes, styles } = uniqueVariantOptions(variants);
  const hasFilters = colors.length > 0 || sizes.length > 0 || styles.length > 0;

  if (!hasFilters) return null;

  const chipBase =
    'inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors';
  const chipActive = 'border-primary bg-primary/10 text-primary';
  const chipIdle = 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground';
  const sizeChipBase =
    'inline-flex min-h-[40px] shrink-0 items-center rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors';

  return (
    <div className="space-y-4">
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('color')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {colors.map(({ slug, label }) => (
              <button
                key={slug}
                type="button"
                onClick={() => onColor(selectedColorSlug === slug ? null : slug)}
                className={cn(chipBase, selectedColorSlug === slug ? chipActive : chipIdle)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('style')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {styles.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStyle(selectedStyle === s ? null : s)}
                className={cn(chipBase, selectedStyle === s ? chipActive : chipIdle)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('size')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSize(selectedSize === s ? null : s)}
                className={cn(sizeChipBase, selectedSize === s ? chipActive : chipIdle)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {(selectedColorSlug || selectedSize || selectedStyle) && (
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
