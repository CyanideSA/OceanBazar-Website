import type { Prisma } from '@prisma/client';
import { calculatePrice, type PricingRow } from './pricing';

type CartItemIncl = Prisma.CartItemGetPayload<{
  include: {
    product: { include: { pricing: true } };
    variant: true;
  };
}>;

export function toPricingRow(
  row:
    | {
        price: unknown;
        tier1MinQty: number | null;
        tier1Discount: unknown;
        tier2MinQty: number | null;
        tier2Discount: unknown;
        tier3MinQty: number | null;
        tier3Discount: unknown;
      }
    | undefined,
): PricingRow | null {
  if (!row) return null;
  return {
    price: Number(row.price),
    compareAt: null,
    tier1MinQty: row.tier1MinQty,
    tier1Discount: row.tier1Discount != null ? Number(row.tier1Discount) : null,
    tier2MinQty: row.tier2MinQty,
    tier2Discount: row.tier2Discount != null ? Number(row.tier2Discount) : null,
    tier3MinQty: row.tier3MinQty,
    tier3Discount: row.tier3Discount != null ? Number(row.tier3Discount) : null,
  };
}

export function applyVariantOverride(row: PricingRow | null, priceOverride: unknown): PricingRow | null {
  if (!row || priceOverride == null) return row;
  return { ...row, price: Number(priceOverride) };
}

export function priceCartItem(
  item: CartItemIncl,
  userType: 'retail' | 'wholesale',
) {
  const retail = item.product.pricing.find((p) => p.customerType === 'retail');
  const wholesale = item.product.pricing.find((p) => p.customerType === 'wholesale');
  const ov = item.variant?.price_override;
  const retailRow = applyVariantOverride(toPricingRow(retail ?? undefined), ov);
  const wholesaleRow = applyVariantOverride(toPricingRow(wholesale ?? undefined), ov);
  return calculatePrice(
    userType,
    { retail: retailRow ?? { price: 0 }, wholesale: wholesaleRow },
    item.quantity,
    item.product.moq,
  );
}

export function buildOrderLinesFromCart(
  items: CartItemIncl[],
  userType: 'retail' | 'wholesale',
) {
  return items.map((item) => {
    const priceResult = priceCartItem(item, userType);
    return {
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      productTitle: item.product.titleEn,
      unitPrice: priceResult.unitPrice,
      quantity: item.quantity,
      lineTotal: priceResult.lineTotal,
      discountPct: priceResult.discountPct,
    };
  });
}
