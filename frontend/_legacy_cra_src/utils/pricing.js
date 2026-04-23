export const RETAIL_MAX_ORDER_QTY = 25;
export const WHOLESALE_VOLUME_MIN_QTY = 26;

export function getCurrentUserType() {
  try {
    const user = JSON.parse(localStorage.getItem("oceanBazarUser") || "{}");
    const value = String(user?.userType || user?.role || "retail").toLowerCase();
    return value === "wholesale" ? "wholesale" : "retail";
  } catch {
    return "retail";
  }
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Fixed retail tiers on base retail price (qty 1–25). */
export function getRetailTierDiscountPct(quantity) {
  const q = Math.max(1, toNumber(quantity, 1));
  if (q === 1) return 0;
  if (q <= 10) return 0.05;
  if (q <= 20) return 0.1;
  if (q <= RETAIL_MAX_ORDER_QTY) return 0.15;
  return 0.15;
}

function resolveWholesaleBreaks(product) {
  const def1 = 100;
  const def2 = 500;
  const def3 = 1000;
  let b1 = product?.wholesaleBreakQty1 != null ? toNumber(product.wholesaleBreakQty1, def1) : def1;
  let b2 = product?.wholesaleBreakQty2 != null ? toNumber(product.wholesaleBreakQty2, def2) : def2;
  let b3 = product?.wholesaleBreakQty3 != null ? toNumber(product.wholesaleBreakQty3, def3) : def3;
  b1 = Math.max(WHOLESALE_VOLUME_MIN_QTY, Math.floor(b1));
  b2 = Math.max(b1, Math.floor(b2));
  b3 = Math.max(b2, Math.floor(b3));
  return [b1, b2, b3];
}

export function getWholesaleVolumeDiscountPct(product, quantity) {
  const q = toNumber(quantity, 1);
  if (q < WHOLESALE_VOLUME_MIN_QTY) return 0;
  const [b1, b2, b3] = resolveWholesaleBreaks(product);
  if (q <= b1) return 0;
  if (q <= b2) return 0.03;
  if (q <= b3) return 0.05;
  return 0.08;
}

export function getRetailBase(product) {
  const rp = toNumber(product?.retailPrice, NaN);
  if (Number.isFinite(rp) && rp >= 0) return rp;
  return toNumber(product?.price, 0);
}

export function getWholesaleBase(product) {
  const w = toNumber(product?.wholesalePrice, NaN);
  if (Number.isFinite(w) && w > 0) return w;
  return getRetailBase(product);
}

export function computeRetailUnitPrice(product, quantity) {
  const base = getRetailBase(product);
  const pct = getRetailTierDiscountPct(quantity);
  return base * (1 - pct);
}

export function computeWholesaleUnitPrice(product, quantity) {
  const q = Math.max(1, toNumber(quantity, 1));
  if (q < WHOLESALE_VOLUME_MIN_QTY) {
    return computeRetailUnitPrice(product, q);
  }
  const base = getWholesaleBase(product);
  const vol = getWholesaleVolumeDiscountPct(product, q);
  return base * (1 - vol);
}

/**
 * Storefront display: matches backend {@link WholesalePricingUtil}.
 */
export function getDisplayPrices(product, userType = "retail", quantity = 1) {
  const retailBase = getRetailBase(product);
  const wholesaleBase = getWholesaleBase(product);
  const isWholesale = String(userType || "").toLowerCase() === "wholesale";
  const q = Math.max(1, toNumber(quantity, 1));
  const unitPrice = isWholesale
    ? computeWholesaleUnitPrice(product, q)
    : computeRetailUnitPrice(product, q);
  const refBase = isWholesale ? wholesaleBase : retailBase;
  const discountPct = refBase > 0 ? Math.max(0, 1 - unitPrice / refBase) : 0;

  return {
    retailBase,
    wholesaleBase,
    unitPrice,
    discountPct,
    strikeRetailForWholesale: isWholesale && retailBase > unitPrice,
  };
}

export function maxOrderQuantityForUser(product, userType) {
  const stock = toNumber(product?.stock, 0);
  const capStock = stock > 0 ? stock : 999999;
  if (String(userType || "").toLowerCase() === "wholesale") {
    return capStock;
  }
  return Math.min(RETAIL_MAX_ORDER_QTY, capStock);
}

/** Client fallback when API omits structured wholesale rows (older caches). */
export function buildWholesalePricingPreview(product) {
  const wb = getWholesaleBase(product);
  const [b1, b2, b3] = resolveWholesaleBreaks(product);
  return [
    { minQty: 1, maxQty: 25, kind: "retail_volume", volumeDiscountPct: 0, pricePerUnit: round2(getRetailBase(product)) },
    { minQty: WHOLESALE_VOLUME_MIN_QTY, maxQty: b1, kind: "wholesale_base", volumeDiscountPct: 0, pricePerUnit: round2(wb) },
    { minQty: b1 + 1, maxQty: b2, kind: "wholesale_vol", volumeDiscountPct: 0.03, pricePerUnit: round2(wb * 0.97) },
    { minQty: b2 + 1, maxQty: b3, kind: "wholesale_vol", volumeDiscountPct: 0.05, pricePerUnit: round2(wb * 0.95) },
    { minQty: b3 + 1, maxQty: null, kind: "wholesale_vol", volumeDiscountPct: 0.08, pricePerUnit: round2(wb * 0.92) },
  ];
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Per-unit manufacturer/list strike (Alibaba-style MSRP pill). Uses compareAtPrice, else price when above retail base.
 */
export function getMsrpPerUnit(product) {
  const c = toNumber(product?.compareAtPrice, NaN);
  if (Number.isFinite(c) && c > 0) return c;
  const list = toNumber(product?.price, NaN);
  const retail = getRetailBase(product);
  if (Number.isFinite(list) && list > retail + 1e-6) return list;
  return null;
}

/** Line total at full retail before volume tiers (qty × base retail). */
export function getFullRetailLineTotal(product, quantity) {
  const q = Math.max(1, toNumber(quantity, 1));
  return round2(getRetailBase(product) * q);
}
