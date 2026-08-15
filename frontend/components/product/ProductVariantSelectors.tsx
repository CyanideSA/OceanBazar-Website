'use client';

import { useTranslations } from 'next-intl';
import type { ProductVariant } from '@/types';
import { brandOptionAccent, uniqueVariantOptions } from '@/lib/variants';
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
    'inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors';
  const sizeChipBase =
    'inline-flex min-h-[40px] shrink-0 items-center rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors';

  return (
    <div className="space-y-4">
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('color')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {colors.map(({ slug, label, hex }) => {
              const active = selectedColorSlug === slug;
              const swatch = hex || null;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onColor(active ? null : slug)}
                  className={cn(
                    chipBase,
                    active
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                  style={
                    swatch
                      ? {
                          borderColor: active ? undefined : swatch,
                          backgroundColor: active ? undefined : `${swatch}22`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: swatch || '#cbd5e1' }}
                    aria-hidden
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('style')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {styles.map((s, i) => {
              const accent = brandOptionAccent(i);
              const active = selectedStyle === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStyle(active ? null : s)}
                  className={cn(chipBase, 'text-white')}
                  style={{
                    backgroundColor: accent,
                    borderColor: accent,
                    boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : undefined,
                    opacity: active ? 1 : 0.92,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('size')}</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {sizes.map((s, i) => {
              const accent = brandOptionAccent(i);
              const active = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSize(active ? null : s)}
                  className={cn(sizeChipBase, 'text-white')}
                  style={{
                    backgroundColor: accent,
                    borderColor: accent,
                    boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : undefined,
                    opacity: active ? 1 : 0.92,
                  }}
                >
                  {s}
                </button>
              );
            })}
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
