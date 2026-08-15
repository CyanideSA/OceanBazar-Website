'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useShopRouter } from '@/lib/shopNavigation';
import { ShieldCheck, Package } from 'lucide-react';
import type { Product, ProductPricing } from '@/types';
import { calculatePrice, parseTierBands, RETAIL_MAX_UNITS, FREE_FEES_THRESHOLD } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { AB_TESTS, trackAbOutcome, useAbVariant } from '@/lib/abTest';

interface Props {
  product: Product;
  variantPriceOverride?: number | null;
  effectiveStock: number;
  variantId?: string | null;
  /** True when the product has variants and the shopper has not picked one yet. */
  selectionRequired?: boolean;
  onAddToCart?: (qty: number, variantId?: string | null) => void;
  onBuyNow?: (qty: number, variantId?: string | null) => void;
}

function tierRows(pricing: ProductPricing | null | undefined) {
  if (!pricing) return [];
  const bands = parseTierBands(pricing);
  if (bands.length > 0) {
    return bands.map((b) => ({ minQty: b.minQty, maxQty: b.maxQty, discount: b.discountPct, price: b.price ?? null }));
  }
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
  return rows.filter(Boolean).map((r) => ({ ...r, price: null })) as Array<{ minQty: number; maxQty: number | null; discount: number; price: number | null }>;
}

/** Resolve which tier index (0 = base, 1-3 = tier) is active for a given qty */
function activeTierIndex(pricing: ProductPricing | null | undefined, qty: number): number {
  if (!pricing) return 0;
  const bands = parseTierBands(pricing);
  if (bands.length > 0) {
    for (let i = bands.length - 1; i >= 0; i -= 1) {
      const band = bands[i];
      if (qty >= band.minQty && (band.maxQty == null || qty <= band.maxQty)) return i + 1;
    }
    return 0;
  }
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

  const currentTotal = pricingResult.lineTotal;
  const previousTotal = previousPrice && previousPrice > pricingResult.unitPrice
    ? Math.round(previousPrice * qty * 100) / 100
    : null;

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

      {/* Total price */}
      <div className="mt-3 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 via-background/70 to-background px-3 py-2.5 shadow-sm">
        <div className="mb-2 h-px w-full bg-gradient-to-r from-primary/35 via-primary/15 to-transparent" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-muted-foreground">
            {tp('total')}
          </span>
          <div className="text-right">
            <div className="text-xl font-extrabold text-foreground">
              {tc('taka')}{currentTotal.toLocaleString('bn-BD')}
            </div>
          </div>
        </div>
        {savings > 0 && previousTotal != null && previousTotal > currentTotal && (
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              {td('youSave')} {tc('taka')}{savings.toLocaleString('bn-BD')}
            </p>
            <div className="text-xs text-muted-foreground line-through">
              {tc('taka')}{previousTotal.toLocaleString('bn-BD')}
            </div>
          </div>
        )}
      </div>

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
                  1{tiers[0]?.minQty ? `–${tiers[0].minQty - 1}` : '+'}
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
                    {tc('taka')}{(tier.price != null ? tier.price : base * (1 - tier.discount / 100)).toFixed(2)}
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
  selectionRequired = false,
  onAddToCart,
  onBuyNow,
}: Props) {
  const td = useTranslations('productDetail');
  const tc = useTranslations('common');
  const tp = useTranslations('product');
  const tpr = useTranslations('pricing');
  const locale = useLocale();
  const router = useShopRouter();
  const [qty, setQty] = useState(1);
  const priceVariant = useAbVariant(AB_TESTS.PRODUCT_PRICE_DISPLAY);
  const audienceVariant = useAbVariant(AB_TESTS.PDP_AUDIENCE);

  const { user } = useAuthStore();
  const isWholesaleUser = user?.userType === 'wholesale';

  const wholesaleAvailable = Boolean(product.pricing.wholesale) && isWholesaleUser;
  const moq = product.moq ?? 1;

  const retailT3Max = product.pricing.retail?.tier3MinQty ?? RETAIL_MAX_UNITS;
  const retailHardMax = Math.min(retailT3Max, effectiveStock > 0 ? effectiveStock : retailT3Max);
  const maxQty = wholesaleAvailable
    ? (effectiveStock > 0 ? effectiveStock : 1)
    : Math.max(1, Math.min(retailHardMax, effectiveStock > 0 ? effectiveStock : retailHardMax));

  // Determine active pricing mode — wholesale only for approved users meeting MOQ
  const isWholesale = wholesaleAvailable && qty >= moq;
  const activeMode: 'retail' | 'wholesale' = isWholesale ? 'wholesale' : 'retail';

  const activePricingData = isWholesale ? product.pricing.wholesale : product.pricing.retail;
  const activeResult = calculatePrice(activeMode, product.pricing, qty, moq, variantPriceOverride);

  useEffect(() => {
    if (qty > maxQty && maxQty > 0) setQty(maxQty);
  }, [maxQty, qty]);

  const clampQty = (n: number) => Math.min(Math.max(1, n), Math.max(1, maxQty));

  return (
    <div className="space-y-4">

      {/* ── 1. Quantity selector — first, above pricing card ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{tp('quantity')}:</span>
        <div className="flex items-center overflow-hidden rounded-lg border border-border shadow-sm">
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
            className="h-11 w-16 border-x border-border bg-background text-center text-sm font-semibold text-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQty(clampQty(qty + 1))}
            className="flex h-11 w-11 items-center justify-center text-lg font-medium text-foreground transition-colors hover:bg-muted"
          >
            +
          </button>
        </div>
        {wholesaleAvailable && !isWholesale && (
          <span className="text-xs text-muted-foreground">
            ({tpr('wholesale')} {tpr('wholesaleFrom')} {moq}+)
          </span>
        )}
      </div>

      {/* ── 2. Active pricing panel ── */}
      <ActivePricingPanel
        mode={activeMode}
        pricingResult={activeResult}
        pricing={activePricingData}
        qty={qty}
        tc={tc}
        td={td}
        tp={tpr}
      />
      {priceVariant === 'B' && activeResult.discountPct > 0 && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Best value: save {activeResult.discountPct}% at this quantity.
        </p>
      )}

      {audienceVariant === 'B' && product.pricing.wholesale && !isWholesaleUser && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-foreground">
          Buying for your business? Wholesale pricing is available for approved OceanBazar accounts.
        </p>
      )}

      {/* MOQ badge */}
      {isWholesale && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
          {tpr('meetsMoq')}
        </div>
      )}

      {/* Free shipping notice */}
      {activeResult.lineTotal >= FREE_FEES_THRESHOLD && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Free shipping + no service charge on this order (subtotal above {FREE_FEES_THRESHOLD.toLocaleString()} BDT)
        </div>
      )}

      {/* ── 3. Trust badges ── */}
      <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {td('orderProtection')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          {td('genuineProduct')}
        </span>
      </div>

      {/* ── 4. CTA buttons ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            onAddToCart?.(qty, variantId ?? null);
            void trackAbOutcome('add_to_cart', {
              value: activeResult.lineTotal,
              metadata: { productId: product.id, quantity: qty, mode: activeMode },
            });
          }}
          disabled={effectiveStock === 0}
          className="flex-1 rounded-lg bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground min-h-[48px]"
        >
          {effectiveStock === 0 ? tp('outOfStock') : selectionRequired ? td('selectOption') : tp('addToCart')}
        </button>
        <button
          type="button"
          disabled={effectiveStock === 0}
          onClick={() => {
            if (onBuyNow) onBuyNow(qty, variantId ?? null);
            else router.push(`/${locale}/checkout`);
          }}
          className={cn(
            'rounded-lg border-2 border-primary px-6 py-3.5 font-semibold text-primary transition-all hover:bg-primary/10 active:scale-[0.98] min-h-[48px]',
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
