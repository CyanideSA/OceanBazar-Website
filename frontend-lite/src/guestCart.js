/**
 * Cookie-backed guest cart for lite storefront (no login required to browse/add).
 * Merged into the server cart after password / OTP / Google login.
 */

const COOKIE = 'ob_lite_guest_cart';
const MAX_LINES = 40;

function cookieOpts() {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.TRUST_PROXY === '1';
  const domain = (process.env.COOKIE_DOMAIN || '').trim() || undefined;
  return {
    httpOnly: false, // readable if needed client-side later; still same-site
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 30 * 86400 * 1000,
    ...(domain ? { domain } : {}),
  };
}

function emptyCart() {
  return { items: [] };
}

function readGuestCart(req) {
  try {
    const raw = req.cookies?.[COOKIE];
    if (!raw) return emptyCart();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
      items: items
        .filter((i) => i && i.productId)
        .map((i) => ({
          productId: String(i.productId),
          variantId: i.variantId ? String(i.variantId) : '',
          quantity: Math.max(1, Number(i.quantity) || 1),
          unitPrice: Number(i.unitPrice || i.price || 0),
          name: String(i.name || i.title || i.productId),
          image: String(i.image || ''),
          product: i.product || {
            id: i.productId,
            titleEn: i.name,
            imageUrl: i.image,
            price: i.unitPrice,
          },
        }))
        .slice(0, MAX_LINES),
    };
  } catch {
    return emptyCart();
  }
}

function writeGuestCart(res, cart) {
  const items = (cart?.items || []).slice(0, MAX_LINES);
  res.cookie(COOKIE, JSON.stringify({ items }), cookieOpts());
}

function clearGuestCart(res) {
  const base = cookieOpts();
  res.clearCookie(COOKIE, { path: base.path, ...(base.domain ? { domain: base.domain } : {}) });
}

function cartTotals(cart) {
  const items = cart?.items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.unitPrice || 0) * Number(i.quantity || 1), 0);
  return {
    items,
    subtotal,
    discount: 0,
    shipping: 0,
    pointsDiscount: 0,
    total: subtotal,
    couponCode: '',
  };
}

function addGuestItem(cart, item) {
  const items = [...(cart.items || [])];
  const productId = String(item.productId);
  const variantId = item.variantId ? String(item.variantId) : '';
  const qty = Math.max(1, Number(item.quantity) || 1);
  const idx = items.findIndex(
    (i) => String(i.productId) === productId && String(i.variantId || '') === variantId,
  );
  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      quantity: Number(items[idx].quantity || 1) + qty,
      unitPrice: Number(item.unitPrice != null ? item.unitPrice : items[idx].unitPrice) || 0,
      name: item.name || items[idx].name,
      image: item.image || items[idx].image,
    };
  } else {
    items.push({
      productId,
      variantId,
      quantity: qty,
      unitPrice: Number(item.unitPrice || 0),
      name: String(item.name || productId),
      image: String(item.image || ''),
      product: {
        id: productId,
        titleEn: item.name,
        imageUrl: item.image,
        price: item.unitPrice,
      },
    });
  }
  return { items: items.slice(0, MAX_LINES) };
}

function updateGuestItem(cart, productId, quantity, variantId = '') {
  const q = Math.max(0, Number(quantity) || 0);
  const items = (cart.items || [])
    .map((i) => {
      if (String(i.productId) !== String(productId)) return i;
      if (String(i.variantId || '') !== String(variantId || '')) return i;
      return { ...i, quantity: q };
    })
    .filter((i) => Number(i.quantity) > 0);
  return { items };
}

function removeGuestItem(cart, productId, variantId = '') {
  const items = (cart.items || []).filter(
    (i) =>
      !(String(i.productId) === String(productId) && String(i.variantId || '') === String(variantId || '')),
  );
  return { items };
}

module.exports = {
  COOKIE,
  readGuestCart,
  writeGuestCart,
  clearGuestCart,
  cartTotals,
  addGuestItem,
  updateGuestItem,
  removeGuestItem,
};
