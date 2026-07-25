function money(amount, currency = '৳') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency}0`;
  return `${currency}${Math.round(n).toLocaleString('en-BD')}`;
}

function pickName(item, locale) {
  if (!item || typeof item !== 'object') return '';
  if (locale === 'bn') {
    return item.nameBn || item.name_bn || item.titleBn || item.name || item.title || '';
  }
  return item.nameEn || item.name_en || item.titleEn || item.name || item.title || '';
}

function productImage(product) {
  if (!product) return '/placeholder.svg';
  const imgs = product.images || product.media || [];
  if (Array.isArray(imgs) && imgs.length) {
    const first = imgs[0];
    if (typeof first === 'string') return first;
    return first.url || first.src || first.secure_url || '/placeholder.svg';
  }
  return product.imageUrl || product.thumbnail || product.coverImage || '/placeholder.svg';
}

function productPrice(product) {
  if (!product) return 0;
  const sale = product.salePrice ?? product.flashPrice ?? product.discountPrice;
  if (sale != null && Number(sale) > 0) return Number(sale);
  return Number(product.price || product.retailPrice || 0);
}

function productCompareAt(product) {
  if (!product) return null;
  const base = Number(product.price || product.retailPrice || 0);
  const sale = productPrice(product);
  if (base > sale) return base;
  const mrp = Number(product.compareAtPrice || product.mrp || 0);
  return mrp > sale ? mrp : null;
}

function productHref(locale, product) {
  const { bp } = require('./config');
  const id = product?.id || product?.productId || '';
  return bp(`/${locale}/product/${encodeURIComponent(id)}`);
}

function safeNext(raw, fallback = '/bn') {
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
  const end = sale.endsAt || sale.endAt || sale.endTime;
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
  productImage,
  productPrice,
  productCompareAt,
  productHref,
  safeNext,
  flashRemainingMs,
  formatCountdown,
  paginationMeta,
  unwrapList,
};
