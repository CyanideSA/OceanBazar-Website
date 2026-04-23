/**
 * Normalizes the route param for API calls (PRD- prefix, decode, strip slashes).
 */
export function normalizeProductIdParam(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  try {
    s = decodeURIComponent(s);
  } catch {
    // keep s
  }
  s = s.replace(/\//g, '').trim();
  if (s.toUpperCase().startsWith('PRD-')) {
    s = s.slice(4).trim();
  }
  return s;
}

/**
 * Safe link to product detail — encodes id for the URL path segment.
 */
export function productDetailPath(productId) {
  const id = productId != null ? String(productId).trim() : '';
  if (!id) return '/products';
  return `/product/${encodeURIComponent(id)}`;
}
