const { authedFetch, requireAuth, readTokens } = require('../session');
const { unwrapList } = require('../helpers');
const { bp } = require('../config');
const { bffGet } = require('../bffClient');
const {
  readGuestCart,
  writeGuestCart,
  cartTotals,
  addGuestItem,
  updateGuestItem,
  removeGuestItem,
} = require('../guestCart');

function mountCart(router) {
  router.get('/:locale/cart', async (req, res) => {
    const locale = req.locale;
    const tokens = readTokens(req);
    if (!tokens.accessToken && !tokens.refreshToken) {
      const guest = cartTotals(readGuestCart(req));
      return res.render('cart', {
        title: res.locals.t('cart'),
        cart: guest,
        needsLogin: false,
        isGuest: true,
      });
    }

    let cart = { items: [] };
    try {
      const { data } = await authedFetch(req, res, '/api/cart');
      cart = normalizeCart(data);
    } catch (err) {
      if (err.status === 401) {
        const guest = cartTotals(readGuestCart(req));
        return res.render('cart', {
          title: res.locals.t('cart'),
          cart: guest,
          needsLogin: false,
          isGuest: true,
        });
      }
      return res.render('cart', {
        title: res.locals.t('cart'),
        cart: { items: [] },
        needsLogin: false,
        isGuest: false,
        errorMsg: err.message || res.locals.t('errorGeneric'),
      });
    }

    res.render('cart', {
      title: res.locals.t('cart'),
      cart,
      needsLogin: false,
      isGuest: false,
    });
  });

  router.post('/:locale/cart/update', async (req, res) => {
    const locale = req.locale;
    const productId = String(req.body.productId || '');
    const quantity = Number(req.body.quantity) || 1;
    const variantId = req.body.variantId || '';
    const tokens = readTokens(req);

    if (!tokens.accessToken && !tokens.refreshToken) {
      const next = updateGuestItem(readGuestCart(req), productId, quantity, variantId);
      writeGuestCart(res, next);
      return res.redirect(bp(`/${locale}/cart`));
    }

    try {
      await authedFetch(req, res, '/api/cart/update', {
        method: 'PUT',
        body: {
          productId,
          quantity,
          variantId: variantId || undefined,
        },
      });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/cart`));
  });

  router.post('/:locale/cart/remove', async (req, res) => {
    const locale = req.locale;
    const productId = String(req.body.productId || '');
    const variantId = req.body.variantId || '';
    const tokens = readTokens(req);

    if (!tokens.accessToken && !tokens.refreshToken) {
      const next = removeGuestItem(readGuestCart(req), productId, variantId);
      writeGuestCart(res, next);
      return res.redirect(bp(`/${locale}/cart`));
    }

    const qs = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    try {
      await authedFetch(req, res, `/api/cart/remove/${encodeURIComponent(productId)}${qs}`, {
        method: 'DELETE',
      });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/cart`));
  });

  router.post('/:locale/cart/coupon', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      await authedFetch(req, res, '/api/cart/apply-coupon', {
        method: 'POST',
        body: { code: String(req.body.code || '').trim() },
      });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/cart`));
  });

  // Legacy cart redeem path — OB points are checkout-only.
  router.post('/:locale/cart/points', requireAuth, async (req, res) => {
    const locale = req.locale;
    res.redirect(
      `${bp(`/${locale}/checkout`)}?notice=${encodeURIComponent(res.locals.t('pointsRedeemHint') || 'Redeem OB Points at checkout')}`,
    );
  });
}

async function resolveProductForGuest(productId, locale) {
  try {
    const data = await bffGet(`/api/products/${encodeURIComponent(productId)}`, { lang: locale });
    const product = data?.product || data;
    if (!product) return null;
    const price = Number(
      product.price ??
        product.unitPrice ??
        product.retailPrice ??
        product.pricing?.[0]?.price ??
        0,
    );
    const name =
      (locale === 'bn' ? product.titleBn || product.titleEn : product.titleEn || product.titleBn) ||
      product.name ||
      productId;
    const image =
      product.imageUrl ||
      product.image ||
      product.productAssets?.[0]?.url ||
      (Array.isArray(product.images) ? product.images[0] : '') ||
      '';
    return { productId, name, unitPrice: price, image, product };
  } catch {
    return null;
  }
}

function normalizeCart(data) {
  if (!data) return { items: [], subtotal: 0, total: 0 };
  const items = unwrapList(data, ['items']).length
    ? unwrapList(data, ['items'])
    : unwrapList(data.cart, ['items']);
  return {
    items,
    subtotal: Number(data.subtotal ?? data.subTotal ?? 0),
    discount: Number(data.discount ?? data.couponDiscount ?? 0),
    shipping: Number(data.shipping ?? data.shippingFee ?? 0),
    pointsDiscount: Number(data.pointsDiscount ?? data.obPointsDiscount ?? 0),
    total: Number(data.total ?? data.grandTotal ?? data.subtotal ?? 0),
    couponCode: data.couponCode || data.coupon || '',
  };
}

module.exports = { mountCart, normalizeCart, resolveProductForGuest };
