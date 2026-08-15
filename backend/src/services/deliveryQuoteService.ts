import * as pathaoService from './pathaoService';

export type DeliveryQuoteInput = {
  pathaoCityId: number;
  pathaoZoneId: number;
  itemWeightKg?: number;
  /** 1 = document, 2 = parcel */
  itemType?: number;
  /** 48 = normal, 12 = on demand */
  deliveryType?: number;
};

export type DeliveryQuoteResult = {
  provider: 'pathao';
  price: number;
  discount?: number;
  storeId: number;
  weightKg: number;
};

function clampWeight(kg?: number): number {
  const n = Number(kg);
  if (!Number.isFinite(n) || n < 0.5) return 0.5;
  if (n > 10) return 10;
  return Math.round(n * 10) / 10;
}

/** Quote Pathao delivery charge for a customer destination zone. */
export async function quotePathaoDelivery(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult> {
  const cityId = Number(input.pathaoCityId);
  const zoneId = Number(input.pathaoZoneId);
  if (!Number.isFinite(cityId) || cityId <= 0 || !Number.isFinite(zoneId) || zoneId <= 0) {
    throw new Error('Valid Pathao city and zone are required to quote delivery');
  }

  const storeId = await pathaoService.getDefaultStoreId();
  const weightKg = clampWeight(input.itemWeightKg);
  const result = await pathaoService.calculatePrice({
    store_id: storeId,
    item_type: input.itemType ?? 2,
    delivery_type: input.deliveryType ?? 48,
    item_weight: weightKg,
    recipient_city: cityId,
    recipient_zone: zoneId,
  });

  const price = Math.max(0, Number(result.price) || 0);
  return {
    provider: 'pathao',
    price,
    discount: result.discount != null ? Number(result.discount) : undefined,
    storeId,
    weightKg,
  };
}

/** Estimate parcel weight from line quantities (0.5 kg minimum). */
export function estimateCartWeightKg(itemCount: number): number {
  const n = Math.max(1, Number(itemCount) || 1);
  return clampWeight(Math.max(0.5, n * 0.3));
}
