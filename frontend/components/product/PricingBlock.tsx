'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Product, ProductPricing } from '@/types';
import { calculatePrice, RETAIL_MAX_UNITS } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface Props {
  product: Product;
  variantPriceOverride?: number | null;
  effectiveStock: number;
  variantId?: string | null;
  onAddToCart?: (qty: number, variantId?: string | null) => void;
  onBuyNow?: (qty: number, variantId?: string | null) => void;
}

function tierRows(pricing: ProductPricing | null | undefined) {
  if (!pricing) return [];
  const rows: Array<{ minQty: number; maxQty: number | null; discount: number } | null> = [
    pricing.tier1MinQty && pricing.tier1Discount != null
      ? {
          minQty: pricing.tier1MinQty,
          discount: pricing.tier1Discount,
          maxQty: pricing.tier2MinQty ? pricing.tier2MinQty - 1 : null,
        }
      : null,
    pricing.tier2MinQty && pricing.tier2Discount != null
      ? {
          minQty: pricing.tier2MinQty,
          discount: pricing.tier2Discount,
          maxQty: pricing.tier3MinQty ? pricing.tier3MinQty - 1 : null,
        }
      : null,
    pricing.tier3MinQty && pricing.tier3Discount != null
      ? { minQty: pricing.tier3MinQty, discount: pricing.tier3Discount, maxQty: null }
      : null,
  ];
  return rows.filter(Boolean) as Array<{ minQty: number; maxQty: number | null; discount: number }>;
}

/** Resolve which tier index (0 = base, 1-3 = tier) is active for a given qty */
function activeTierIndex(pricing: ProductPricing | null | undefined, qty: number): number {
  if (!pricing) return 0;
  const t3 = pricing.tier3MinQty ?? Infinity;
  const t2 = pricing.tier2MinQty ?? Infinity;
  const t1 = pricing.tier1MinQty ?? Infinity;
  if (qty >= t3 && pricing.tier3Discount != null) return 3;
  if (qty >= t2 && pricing.tier2Discount != null) return 2;
  if (qty >= t1 && pricing.tier1Discount != null) return 1;
  return 0;
}

function ActivePricingPanel({
  mode,
  pricingResult,
  pricing,
  qty,
  tc,
  td,
  tp,
}: {
  mode: 'retail' | 'wholesale';
  pricingResult: ReturnType<typeof calculatePrice>;
  pricing: ProductPricing | null | undefined;
  qty: number;
  tc: (k: string) => string;
  td: (k: string) => string;
  tp: (k: string) => string;
}) {
  const base = Number(pricing?.price ?? 0);
  const compareAt = pricing?.compareAt != null ? Number(pricing.compareAt) : null;

  const previousPrice = compareAt && compareAt > pricingResult.unitPrice
    ? compareAt
    : pricingResult.discountPct > 0
      ? Math.round(base * 100) / 100
      : null;

  const savings = previousPrice && previousPrice > pricingResult.unitPrice
    ? Math.round((previousPrice - pricingResult.unitPrice) * qty * 100) / 100
    : 0;

  const tiers = tierRows(pricing);
  const activeIdx = activeTierIndex(pricing, qty);

  const isWholesale = mode === 'wholesale';

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        'transition-all duration-300 ease-in-out',
        isWholesale
          ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
          : 'border-primary/30 bg-primary/5 ring-1 ring-primary/20',
      )}
    >
      {/* Mode badge */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
            isWholesale
              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
              : 'bg-primary/15 text-primary',
          )}
        >
          {isWholesale ? tp('wholesale') : tp('retail')}
        </span>
        {pricingResult.discountPct > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            -{pricingResult.discountPct}% {td('volumeTier').toLowerCase()}
          </span>
        )}
      </div>

      {/* Current vs previous price */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-extrabold text-foreground">
          {tc('taka')}
          {pricingResult.unitPrice.toLocaleString('bn-BD')}
        </span>
        {previousPrice != null && (
          <span className="text-base text-muted-foreground line-through">
            {tc('taka')}
            {previousPrice.toLocaleString('bn-BD')}
          </span>
        )}
      </div>

      {/* Savings */}
      {savings > 0 && (
        <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {td('youSave')} {tc('taka')}{savings.toLocaleString('bn-BD')}
        </p>
      )}

      {/* Tier table */}
      {tiers.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border text-xs">
          <table className="w-full min-w-[240px]">
            <thead className="bg-muted/80">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{td('qtyRange')}</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{td('discountCol')}</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">{td('unit')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Base row */}
              <tr
                className={cn(
                  'border-t border-border',
                  activeIdx === 0 && 'bg-primary/10 font-semibold',
                )}
              >
                <td className="px-2 py-1.5 text-foreground">
                  1{pricing?.tier1MinQty ? `–${pricing.tier1MinQty - 1}` : '+'}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right font-medium text-foreground">
                  {tc('taka')}{base.toLocaleString()}
                </td>
              </tr>
              {tiers.map((tier, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-t border-border',
                    activeIdx === i + 1 && 'bg-primary/10 font-semibold',
                  )}
                >
                  <td className="px-2 py-1.5 text-foreground">
                    {tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : '+'}
                  </td>
                  <td className="px-2 py-1.5 text-emerald-600 dark:text-emerald-400">
                    -{tier.discount}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-foreground">
                    {tc('taka')}{(base * (1 - tier.discount / 100)).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PricingBlock({
  product,
  variantPriceOverride,
  effectiveStock,
  variantId,
  onAddToCart,
  onBuyNow,
}: Props) {
  const td = useTranslations('productDetail');
  const tc = useTranslations('common');
  const tp = useTranslations('product');
  const tpr = useTranslations('pricing');
  const locale = useLocale();
  const router = useRouter();
  const [qty, setQty] = useState(1);

  const wholesaleAvailable = Boolean(product.pricing.wholesale);
  const moq = product.moq ?? 1;

  // Retail max: hard cap at RETAIL_MAX_UNITS (or stock, whichever is lower)
  const retailHardMax = Math.min(RETAIL_MAX_UNITS, effectiveStock > 0 ? effectiveStock : RETAIL_MAX_UNITS);
  const maxQty = effectiveStock > 0 ? effectiveStock : 1;

  // Determine active pricing mode purely from qty
  const isWholesale = wholesaleAvailable && qty >= moq;
  const activeMode: 'retail' | 'wholesale' = isWholesale ? 'wholesale' : 'retail';

  const activePricingData = isWholesale ? product.pricing.wholesale : product.pricing.retail;
  const activeResult = calculatePrice(activeMode, product.pricing, qty, moq, variantPriceOverride);

  // For line-total display
  const lineTotalDisplay = activeResult.lineTotal;

  useEffect(() => {
    if (qty > maxQty && maxQty > 0) setQty(maxQty);
  }, [maxQty, qty]);

  const clampQty = (n: number) => Math.min(Math.max(1, n), Math.max(1, maxQty));

  return (
    <div className="space-y-4">
      {/* Single active pricing panel — transitions when mode switches */}
      <ActivePricingPanel
        mode={activeMode}
        pricingResult={activeResult}
        pricing={activePricingData}
        qty={qty}
        tc={tc}
        td={td}
        tp={tpr}
      />

      {/* Contextual hint: retail limit / wholesale threshold */}
      {wholesaleAvailable && !isWholesale && (
        <p className="text-xs text-muted-foreground">
          {td('retailMax', { n: retailHardMax })}{' '}
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            ({tpr('wholesale')} {tpr('wholesaleFrom')} {moq}+)
          </span>
        </p>
      )}
      {isWholesale && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
          {tpr('meetsMoq')}
        </div>
      )}

      {/* Quantity selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">{tp('quantity')}:</span>
        <div className="flex items-center overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setQty(clampQty(qty - 1))}
            className="flex h-11 w-11 items-center justify-center text-lg font-medium text-foreground transition-colors hover:bg-muted"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={Math.max(1, maxQty)}
            value={qty}
            onChange={(e) => setQty(clampQty(parseInt(e.target.value, 10) || 1))}
            className="h-11 w-16 border-x border-border bg-background text-center text-sm font-medium text-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQty(clampQty(qty + 1))}
            className="flex h-11 w-11 items-center justify-center text-lg font-medium text-foreground transition-colors hover:bg-muted"
          >
            +
          </button>
        </div>
        <span className="text-sm text-muted-foreground">
          = {tc('taka')}{lineTotalDisplay.toLocaleString('bn-BD')}
        </span>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onAddToCart?.(qty, variantId ?? null)}
          disabled={effectiveStock === 0}
          className="flex-1 rounded-lg bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground min-h-[48px]"
        >
          {effectiveStock === 0 ? tp('outOfStock') : tp('addToCart')}
        </button>
        <button
          type="button"
          disabled={effectiveStock === 0}
          onClick={() => {
            if (onBuyNow) onBuyNow(qty, variantId ?? null);
            else router.push(`/${locale}/checkout`);
          }}
          className={cn(
            'rounded-lg border-2 border-primary px-6 py-3.5 font-semibold text-primary transition-colors hover:bg-primary/10 min-h-[48px]',
            effectiveStock === 0 && 'cursor-not-allowed border-muted text-muted-foreground hover:bg-transparent',
          )}
        >
          {tp('buyNow')}
        </button>
      </div>

      {product.moq > 1 && !wholesaleAvailable && (
        <p className="text-xs text-muted-foreground">
          {tp('moq')}: {product.moq} {tc('perUnit')}
        </p>
      )}
    </div>
  );
}
