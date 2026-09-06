function money(amount, currency = '৳', locale = 'en') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency}0`;
  const loc = locale === 'bn' ? 'bn-BD' : 'en-BD';
  return `${currency}${Math.round(n).toLocaleString(loc)}`;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function pickName(item, locale) {
  if (!item || typeof item !== 'object') return '';
  if (locale === 'bn') {
    return item.nameBn || item.name_bn || item.titleBn || item.name || item.title || '';
  }
  return item.nameEn || item.name_en || item.titleEn || item.name || item.title || '';
}

function productId(product) {
  if (!product) return '';
  return String(product.id || product.productId || product.sku || '');
}

/** Inject Cloudinary transforms for smaller mobile payloads. */
function optimizeImageUrl(url, opts = {}) {
  if (!url || typeof url !== 'string') return url || '';
  if (!url.includes('res.cloudinary.com')) return url;
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const rest = url.slice(i + marker.length);
  if (/^f_|^q_|^w_|^h_|^c_/.test(rest)) return url;
  const width = opts.width || 480;
  const parts = [`f_auto`, `q_auto`, `w_${width}`, `c_${opts.crop || 'limit'}`];
  if (opts.height) parts.push(`h_${opts.height}`);
  const transform = parts.join(',');
  if (rest.startsWith('v') && /^v\d+\//.test(rest)) {
    return `${url.slice(0, i + marker.length)}${transform}/${rest}`;
  }
  return `${url.slice(0, i + marker.length)}${transform}/${rest}`;
}

function productImage(product, opts = {}) {
  const { bp } = require('./config');
  const fallback = bp('/placeholder.svg');
  if (!product) return fallback;
  let raw = '';
  if (product.primaryImage) raw = product.primaryImage;
  else {
    const imgs = product.images || product.media || [];
    if (Array.isArray(imgs) && imgs.length) {
      const first = imgs[0];
      raw = typeof first === 'string' ? first : first.url || first.src || first.secure_url || '';
    }
    if (!raw) raw = product.imageUrl || product.thumbnail || product.coverImage || '';
  }
  if (!raw) return fallback;
  return optimizeImageUrl(raw, { width: opts.width || 480, crop: 'limit' });
}

function resolveUserType(user) {
  if (!user) return 'retail';
  const t = String(user.customerType || user.userType || user.type || user.accountType || 'retail').toLowerCase();
  return t === 'wholesale' ? 'wholesale' : 'retail';
}

function parseTierBands(pricing) {
  const raw = pricing?.tierBands;
  if (!Array.isArray(raw)) return [];
  const bands = [];
  for (const band of raw) {
    const minQty = Number(band?.minQty);
    const maxRaw = band?.maxQty;
    const maxQty = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
    const discountPct = Number(band?.discountPct ?? 0);
    const priceRaw = band?.price;
    const price = priceRaw == null || priceRaw === '' ? null : Number(priceRaw);
    if (!Number.isFinite(minQty) || minQty < 1) continue;
    if (maxQty != null && (!Number.isFinite(maxQty) || maxQty < minQty)) continue;
    if (!Number.isFinite(discountPct) || discountPct < 0) continue;
    bands.push({ minQty, maxQty, discountPct, price });
  }
  return bands.sort((a, b) => a.minQty - b.minQty);
}

function resolveBandForQty(bands, qty) {
  for (let i = bands.length - 1; i >= 0; i -= 1) {
    const band = bands[i];
    if (qty >= band.minQty && (band.maxQty == null || qty <= band.maxQty)) {
      return { index: i + 1, band };
    }
  }
  return null;
}

function calculateRetailPrice(pricing, qty) {
  if (!pricing) return { unitPrice: 0, discountPct: 0, lineTotal: 0, tierApplied: 0 };
  const base = Number(pricing.price) || 0;
  let discountPct = 0;
  let tierApplied = 0;
  const q = Math.max(1, Number(qty) || 1);

  const bands = parseTierBands(pricing);
  if (q > 1 && bands.length > 0) {
    const resolved = resolveBandForQty(bands, q);
    if (resolved) {
      tierApplied = resolved.index;
      discountPct = resolved.band.discountPct;
      const explicitPrice = resolved.band.price;
      const unitPrice = round2(
        explicitPrice != null && Number.isFinite(explicitPrice)
          ? explicitPrice
          : base * (1 - discountPct / 100),
      );
      return { unitPrice, discountPct, lineTotal: round2(unitPrice * q), tierApplied };
    }
  }

  if (q > 1) {
    const t1 = pricing.tier1MinQty ?? Infinity;
    const t2 = pricing.tier2MinQty ?? Infinity;
    const t3 = pricing.tier3MinQty ?? Infinity;
    if (q >= t3 && pricing.tier3Discount != null) {
      discountPct = Number(pricing.tier3Discount);
      tierApplied = 3;
    } else if (q >= t2 && pricing.tier2Discount != null) {
      discountPct = Number(pricing.tier2Discount);
      tierApplied = 2;
    } else if (q >= t1 && pricing.tier1Discount != null) {
      discountPct = Number(pricing.tier1Discount);
      tierApplied = 1;
    }
  }

  const unitPrice = round2(base * (1 - discountPct / 100));
  return { unitPrice, discountPct, lineTotal: round2(unitPrice * q), tierApplied };
}

function calculateWholesalePrice(retail, wholesale, qty, moq) {
  const q = Math.max(1, Number(qty) || 1);
  if (q < moq) return calculateRetailPrice(retail, q);
  const base = Number(wholesale.price) || 0;
  let discountPct = 0;
  let tierApplied = 0;

  const bands = parseTierBands(wholesale);
  if (bands.length > 0) {
    const resolved = resolveBandForQty(bands, q);
    if (resolved) {
      tierApplied = resolved.index;
      discountPct = resolved.band.discountPct;
      const explicitPrice = resolved.band.price;
      const unitPrice = round2(
        explicitPrice != null && Number.isFinite(explicitPrice)
          ? explicitPrice
          : base * (1 - discountPct / 100),
      );
      return { unitPrice, discountPct, lineTotal: round2(unitPrice * q), tierApplied };
    }
  }

  const t1 = wholesale.tier1MinQty ?? Infinity;
  const t2 = wholesale.tier2MinQty ?? Infinity;
  const t3 = wholesale.tier3MinQty ?? Infinity;
  if (q >= t3 && wholesale.tier3Discount != null) {
    discountPct = Number(wholesale.tier3Discount);
    tierApplied = 3;
  } else if (q >= t2 && wholesale.tier2Discount != null) {
    discountPct = Number(wholesale.tier2Discount);
    tierApplied = 2;
  } else if (q >= t1 && wholesale.tier1Discount != null) {
    discountPct = Number(wholesale.tier1Discount);
    tierApplied = 1;
  }

  const unitPrice = round2(base * (1 - discountPct / 100));
  return { unitPrice, discountPct, lineTotal: round2(unitPrice * q), tierApplied };
}

/** Mirrors frontend/lib/pricing.ts calculatePrice — display only; cart/checkout use BFF. */
function calculatePrice(userType, pricing, qty, moq, variantPriceOverride) {
  if (!pricing || !pricing.retail) {
    return { unitPrice: 0, discountPct: 0, lineTotal: 0, tierApplied: 0 };
  }
  const retail =
    variantPriceOverride != null
      ? { ...pricing.retail, price: variantPriceOverride }
      : pricing.retail;
  const wholesale = pricing.wholesale
    ? variantPriceOverride != null
      ? { ...pricing.wholesale, price: variantPriceOverride }
      : pricing.wholesale
    : null;
  const q = Math.max(1, Number(qty) || 1);
  const m = Math.max(1, Number(moq) || 1);
  if (userType === 'wholesale' && wholesale && q >= m) {
    return calculateWholesalePrice(retail, wholesale, q, m);
  }
  return calculateRetailPrice(retail, q);
}

function productPricingBundle(product) {
  if (!product) return { retail: null, wholesale: null };
  if (product.pricing && (product.pricing.retail || product.pricing.wholesale)) {
    return product.pricing;
  }
  if (product.retailPrice != null || product.price != null) {
    return {
      retail: {
        price: Number(product.retailPrice ?? product.price ?? 0),
        compareAt: product.compareAtPrice ?? product.mrp ?? null,
      },
      wholesale:
        product.wholesalePrice != null
          ? { price: Number(product.wholesalePrice) }
          : null,
    };
  }
  return { retail: null, wholesale: null };
}

const RETAIL_MAX_UNITS = 25;
const FREE_FEES_THRESHOLD = 5000;
const GST_RATE = 0.075;
const BASE_SHIPPING_FEE = 25;
/** Customers pay merchandise (VAT-inclusive) + shipping only — no service fee. */
const BASE_SERVICE_FEE = 0;
const COD_LIMIT = 5000;

function calculateOrderTotals(subtotal, couponDiscount = 0, obDiscount = 0, opts = {}) {
  const discount = round2(Math.max(0, Number(couponDiscount) || 0));
  const merchandise = Math.max(0, Number(subtotal) || 0);
  const after = Math.max(0, merchandise - discount);
  const thresholdWaiver = merchandise >= FREE_FEES_THRESHOLD && opts.retailQuantityOrder === true;
  const shippingFee = opts.couponFreeShipping || thresholdWaiver ? 0 : BASE_SHIPPING_FEE;
  const serviceFee = opts.couponFreeService || thresholdWaiver ? 0 : BASE_SERVICE_FEE;
  const vatRate =
    opts.vatRate != null && Number.isFinite(Number(opts.vatRate))
      ? Math.max(0, Number(opts.vatRate))
      : GST_RATE;
  const priceInclusive = Boolean(opts.priceInclusive);
  let gst = 0;
  let taxableAmount = round2(after);
  if (!opts.couponFreeVat && vatRate > 0) {
    if (priceInclusive) {
      taxableAmount = round2(after / (1 + vatRate));
      gst = round2(after - taxableAmount);
    } else {
      gst = round2(after * vatRate);
    }
  }
  const merchandiseDue = priceInclusive ? after : after + gst;
  const clampedOb = round2(Math.min(Number(obDiscount) || 0, merchandiseDue + shippingFee + serviceFee));
  const total = round2(Math.max(0, merchandiseDue + shippingFee + serviceFee - clampedOb));
  return {
    subtotal: round2(merchandise),
    discount,
    gst,
    shippingFee,
    serviceFee,
    obDiscount: clampedOb,
    total,
    taxableAmount,
    vatInclusive: priceInclusive,
    vatRate,
  };
}

function previewCheckoutTotals(cart, extras = {}) {
  const subtotal = Number(cart?.subtotal || 0);
  const couponDiscount = Number(cart?.discount || extras.couponDiscount || 0);
  const obDiscount = Number(
    extras.obDiscount != null
      ? extras.obDiscount
      : cart?.pointsDiscount || cart?.obPointsDiscount || 0,
  );
  const retailQuantityOrder =
    extras.retailQuantityOrder != null
      ? Boolean(extras.retailQuantityOrder)
      : cart?.retailQuantityOrder !== false;
  const base = calculateOrderTotals(subtotal, couponDiscount, obDiscount, {
    couponFreeShipping: Boolean(cart?.freeShipping || extras.couponFreeShipping),
    couponFreeService: Boolean(cart?.freeService || extras.couponFreeService),
    couponFreeVat: Boolean(cart?.freeVat || extras.couponFreeVat),
    retailQuantityOrder,
    priceInclusive: true,
  });
  if (extras.courierShippingFee != null && Number.isFinite(Number(extras.courierShippingFee)) && base.shippingFee > 0) {
    const fee = Number(extras.courierShippingFee);
    const delta = fee - base.shippingFee;
    return {
      ...base,
      shippingFee: fee,
      total: round2(Math.max(0, base.total + delta)),
    };
  }
  return base;
}

const checkoutMeta = {
  gstRate: GST_RATE,
  shippingFlat: BASE_SHIPPING_FEE,
  serviceFlat: BASE_SERVICE_FEE,
  freeFeesThreshold: FREE_FEES_THRESHOLD,
  codLimit: COD_LIMIT,
  gatewayFeeRate: 0.025,
  passThroughGatewayFee: false,
  vatInclusive: true,
};

/** VAT rate as a display percentage — 7.5% must not round to "8%". */
function formatVatPercent(rate = GST_RATE) {
  const percent = (Number(rate) || 0) * 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
}

function customerPaymentFee(orderTotalBeforeFee, paymentMethod) {
  const method = String(paymentMethod || '').toLowerCase();
  const online =
    method === 'sslcommerz' ||
    method === 'bkash' ||
    method === 'nagad' ||
    method === 'rocket' ||
    method === 'upay';
  if (!online || !checkoutMeta.passThroughGatewayFee) {
    return { feeAmount: 0, totalWithFee: orderTotalBeforeFee, applied: false };
  }
  const feeAmount = round2(orderTotalBeforeFee * checkoutMeta.gatewayFeeRate);
  return {
    feeAmount,
    totalWithFee: round2(orderTotalBeforeFee + feeAmount),
    applied: feeAmount > 0,
  };
}

/** Mirrors backend getRetailMaxQty — last retail tier max / tier3MinQty / 25. */
function getRetailMaxQty(retailPricing) {
  if (!retailPricing) return RETAIL_MAX_UNITS;
  if (retailPricing.maxQty != null && Number(retailPricing.maxQty) > 0) {
    return Math.floor(Number(retailPricing.maxQty));
  }
  const bands = parseTierBands(retailPricing);
  if (bands.length) {
    const last = bands[bands.length - 1];
    if (last.maxQty != null) return last.maxQty;
    return RETAIL_MAX_UNITS;
  }
  const t3 = Number(retailPricing.tier3MinQty);
  return Number.isFinite(t3) && t3 > 0 ? t3 : RETAIL_MAX_UNITS;
}

/** Last wholesale tier max; null ⇒ unlimited (stock only). */
function getWholesaleCapQty(wholesalePricing) {
  if (!wholesalePricing) return null;
  if (wholesalePricing.maxQty != null && Number(wholesalePricing.maxQty) > 0) {
    return Math.floor(Number(wholesalePricing.maxQty));
  }
  const bands = parseTierBands(wholesalePricing);
  if (bands.length) {
    const last = bands[bands.length - 1];
    return last.maxQty;
  }
  return null;
}

function productStock(product) {
  if (!product) return 0;
  const n = Number(product.stock);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Max purchasable qty for this customer — mirrors PricingBlock:
 * retail → min(retailMax, stock[, flash limits])
 * wholesale user → min(stock[, wholesaleCap][, flash limits])
 */
function resolveProductMaxQty(product, opts = {}) {
  if (!product) return 1;
  const userType = opts.userType || 'retail';
  const pricing = productPricingBundle(product);
  const stock = productStock(product);
  const stockCap = stock > 0 ? stock : null;
  const flashCapCandidates = [];
  if (product.flashPerCustomerLimit != null && Number(product.flashPerCustomerLimit) > 0) {
    flashCapCandidates.push(Math.floor(Number(product.flashPerCustomerLimit)));
  }
  if (product.flashAvailable != null && Number(product.flashAvailable) >= 0) {
    flashCapCandidates.push(Math.floor(Number(product.flashAvailable)));
  }
  const flashCap = flashCapCandidates.length ? Math.min.apply(null, flashCapCandidates) : null;

  let cap;
  if (userType === 'wholesale' && pricing.wholesale) {
    const whCap = getWholesaleCapQty(pricing.wholesale);
    cap = whCap != null && whCap > 0 ? whCap : stockCap != null ? stockCap : 9999;
  } else {
    const retailCap = getRetailMaxQty(pricing.retail);
    cap = retailCap;
  }
  if (stockCap != null) cap = Math.min(cap, stockCap);
  if (flashCap != null) cap = Math.min(cap, flashCap);
  return Math.max(1, Math.floor(cap) || 1);
}

function resolveActiveMode(userType, pricing, qty, moq) {
  const q = Math.max(1, Number(qty) || 1);
  const m = Math.max(1, Number(moq) || 1);
  if (userType === 'wholesale' && pricing && pricing.wholesale && q >= m) return 'wholesale';
  return 'retail';
}

function productPrice(product, opts = {}) {
  if (!product) return 0;
  const userType = opts.userType || 'retail';
  const qty = opts.qty || 1;
  const pricing = productPricingBundle(product);
  if (pricing.retail) {
    return calculatePrice(userType, pricing, qty, product.moq || 1, opts.variantPrice).unitPrice;
  }
  const sale = product.salePrice ?? product.flashPrice ?? product.discountPrice;
  if (sale != null && Number(sale) > 0) return Number(sale);
  return Number(product.price || product.retailPrice || 0);
}

function productCompareAt(product, opts = {}) {
  if (!product) return null;
  const userType = opts.userType || 'retail';
  const qty = opts.qty || 1;
  const pricing = productPricingBundle(product);
  const moq = product.moq || 1;
  const mode = resolveActiveMode(userType, pricing, qty, moq);
  const active = mode === 'wholesale' ? pricing.wholesale : pricing.retail;
  const unit = productPrice(product, opts);
  const compareAt = active?.compareAt != null ? Number(active.compareAt) : null;
  if (compareAt != null && Number.isFinite(compareAt) && compareAt > unit) return compareAt;
  const base = Number(active?.price ?? pricing.retail?.price ?? product.retailPrice ?? product.price ?? 0);
  if (base > unit) return base;
  const mrp = Number(product.compareAtPrice || product.mrp || 0);
  return mrp > unit ? mrp : null;
}

function productTierHints(product, opts = {}) {
  const userType = opts.userType || 'retail';
  const qty = opts.qty || 1;
  const pricing = productPricingBundle(product);
  const mode =
    opts.mode ||
    resolveActiveMode(userType, pricing, qty, product.moq || 1);
  const active = mode === 'wholesale' && pricing.wholesale ? pricing.wholesale : pricing.retail;
  if (!active) return [];
  const bands = parseTierBands(active);
  if (bands.length) {
    return bands.map((b) => ({
      minQty: b.minQty,
      maxQty: b.maxQty,
      discountPct: b.discountPct,
      price: b.price != null ? b.price : round2(Number(active.price) * (1 - Number(b.discountPct || 0) / 100)),
    }));
  }
  const out = [];
  const base = Number(active.price) || 0;
  if (active.tier1MinQty && active.tier1Discount != null) {
    out.push({
      minQty: active.tier1MinQty,
      maxQty: active.tier2MinQty ? active.tier2MinQty - 1 : null,
      discountPct: Number(active.tier1Discount),
      price: round2(base * (1 - Number(active.tier1Discount) / 100)),
    });
  }
  if (active.tier2MinQty && active.tier2Discount != null) {
    out.push({
      minQty: active.tier2MinQty,
      maxQty: active.tier3MinQty ? active.tier3MinQty - 1 : null,
      discountPct: Number(active.tier2Discount),
      price: round2(base * (1 - Number(active.tier2Discount) / 100)),
    });
  }
  if (active.tier3MinQty && active.tier3Discount != null) {
    out.push({
      minQty: active.tier3MinQty,
      maxQty: null,
      discountPct: Number(active.tier3Discount),
      price: round2(base * (1 - Number(active.tier3Discount) / 100)),
    });
  }
  return out;
}

/** Full PDP pricing snapshot for SSR + client recalculation. */
function productPricingState(product, user) {
  const userType = resolveUserType(user);
  const pricing = productPricingBundle(product);
  const moq = Math.max(1, Number(product?.moq) || 1);
  const stock = productStock(product);
  const maxQty = resolveProductMaxQty(product, { userType });
  const wholesaleAvailable = userType === 'wholesale' && Boolean(pricing.wholesale);
  const qty = 1;
  const mode = resolveActiveMode(userType, pricing, qty, moq);
  const result = calculatePrice(userType, pricing, qty, moq);
  const retailTiers = productTierHints(product, { userType: 'retail', mode: 'retail' });
  const wholesaleTiers = pricing.wholesale
    ? productTierHints(product, { userType: 'wholesale', mode: 'wholesale' })
    : [];
  return {
    userType,
    wholesaleAvailable,
    moq,
    stock,
    maxQty,
    mode,
    unitPrice: result.unitPrice,
    discountPct: result.discountPct,
    lineTotal: result.lineTotal,
    tierApplied: result.tierApplied,
    retail: pricing.retail
      ? {
          price: Number(pricing.retail.price) || 0,
          compareAt: pricing.retail.compareAt != null ? Number(pricing.retail.compareAt) : null,
          tier1MinQty: pricing.retail.tier1MinQty,
          tier1Discount: pricing.retail.tier1Discount,
          tier2MinQty: pricing.retail.tier2MinQty,
          tier2Discount: pricing.retail.tier2Discount,
          tier3MinQty: pricing.retail.tier3MinQty,
          tier3Discount: pricing.retail.tier3Discount,
          tierBands: parseTierBands(pricing.retail),
          maxQty: getRetailMaxQty(pricing.retail),
        }
      : null,
    wholesale: pricing.wholesale
      ? {
          price: Number(pricing.wholesale.price) || 0,
          compareAt: pricing.wholesale.compareAt != null ? Number(pricing.wholesale.compareAt) : null,
          tier1MinQty: pricing.wholesale.tier1MinQty,
          tier1Discount: pricing.wholesale.tier1Discount,
          tier2MinQty: pricing.wholesale.tier2MinQty,
          tier2Discount: pricing.wholesale.tier2Discount,
          tier3MinQty: pricing.wholesale.tier3MinQty,
          tier3Discount: pricing.wholesale.tier3Discount,
          tierBands: parseTierBands(pricing.wholesale),
          maxQty: getWholesaleCapQty(pricing.wholesale),
        }
      : null,
    retailTiers,
    wholesaleTiers,
    flashPerCustomerLimit:
      product?.flashPerCustomerLimit != null ? Number(product.flashPerCustomerLimit) : null,
    flashAvailable: product?.flashAvailable != null ? Number(product.flashAvailable) : null,
    flashDeal: Boolean(product?.flashDeal),
  };
}

function productHref(locale, product) {
  const { bp } = require('./config');
  const id = productId(product);
  return bp(`/${locale}/product/${encodeURIComponent(id)}`);
}

function safeNext(raw, fallback = '/en') {
  const { BASE_PATH, bp } = require('./config');
  if (!raw || typeof raw !== 'string') return bp(fallback);
  if (!raw.startsWith('/') || raw.startsWith('//')) return bp(fallback);
  if (BASE_PATH && !raw.startsWith(BASE_PATH) && !raw.startsWith('/prefer')) {
    return bp(raw);
  }
  return raw;
}

function flashRemainingMs(sale) {
  if (!sale) return 0;
  // API sale rows use snake_case ends_at; keep camelCase fallbacks for safety.
  const src = sale.sale || sale;
  const end =
    src.endsAt || src.endAt || src.endTime || src.ends_at || src.end_at || src.end_time;
  if (!end) return 0;
  const ms = new Date(end).getTime() - Date.now();
  return ms > 0 ? ms : 0;
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function paginationMeta(pagination, page, limit) {
  const total = Number(pagination?.total || 0);
  const pages = Number(pagination?.pages || Math.ceil(total / limit) || 1);
  return {
    page: Number(page) || 1,
    limit: Number(limit) || 24,
    total,
    pages: Math.max(1, pages),
  };
}

function unwrapList(data, keys) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

module.exports = {
  money,
  pickName,
  productId,
  productImage,
  optimizeImageUrl,
  productPrice,
  productCompareAt,
  productTierHints,
  productPricingBundle,
  productPricingState,
  calculatePrice,
  resolveUserType,
  resolveProductMaxQty,
  resolveActiveMode,
  getRetailMaxQty,
  getWholesaleCapQty,
  productStock,
  RETAIL_MAX_UNITS,
  FREE_FEES_THRESHOLD,
  productHref,
  safeNext,
  flashRemainingMs,
  formatCountdown,
  paginationMeta,
  unwrapList,
  calculateOrderTotals,
  previewCheckoutTotals,
  checkoutMeta,
  formatVatPercent,
  customerPaymentFee,
  GST_RATE,
  BASE_SHIPPING_FEE,
  BASE_SERVICE_FEE,
  COD_LIMIT,
};
