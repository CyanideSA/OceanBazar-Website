import * as pathaoService from './pathaoService';

const DEFAULT_ITEM_WEIGHT_KG = 0.5;
const MIN_WEIGHT_KG = 0.5;
const WEIGHT_PER_ITEM_KG = 0.25;

/**
 * Rough parcel weight estimate from cart line count.
 * Pathao requires a positive weight; we keep a 0.5kg floor.
 */
export function estimateCartWeightKg(itemCount: number): number {
  const n = Number.isFinite(itemCount) ? Math.max(1, Math.floor(itemCount)) : 1;
  return Math.max(MIN_WEIGHT_KG, Number((n * WEIGHT_PER_ITEM_KG).toFixed(2)));
}

export async function quotePathaoDelivery(input: {
  pathaoCityId: number;
  pathaoZoneId: number;
  itemWeightKg?: number;
  storeId?: number;
  itemType?: number;
  deliveryType?: number;
}): Promise<{ price: number; provider: 'pathao'; discount?: number }> {
  const storeId = input.storeId || Number(process.env.PATHAO_STORE_ID) || 1;
  const weight = Math.max(MIN_WEIGHT_KG, Number(input.itemWeightKg) || DEFAULT_ITEM_WEIGHT_KG);
  const result = await pathaoService.calculatePrice({
    store_id: storeId,
    item_type: input.itemType || 2,
    delivery_type: input.deliveryType || 48,
    item_weight: weight,
    recipient_city: input.pathaoCityId,
    recipient_zone: input.pathaoZoneId,
  });
  if (!Number.isFinite(result.price) || result.price <= 0) {
    throw new Error('Pathao returned an empty delivery price');
  }
  return {
    price: result.price,
    provider: 'pathao',
    discount: result.discount,
  };
}
