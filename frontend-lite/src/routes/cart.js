const { authedFetch, requireAuth, readTokens } = require('../session');
const { unwrapList } = require('../helpers');
const { bp } = require('../config');

function mountCart(router) {
  router.get('/:locale/cart', async (req, res) => {
    const locale = req.locale;
    const tokens = readTokens(req);
    if (!tokens.accessToken && !tokens.refreshToken) {
      return res.render('cart', {
        title: res.locals.t('cart'),
        cart: { items: [] },
        needsLogin: true,
      });
    }

    let cart = { items: [] };
    try {
      const { data } = await authedFetch(req, res, '/api/cart');
      cart = normalizeCart(data);
    } catch (err) {
      return res.render('cart', {
        title: res.locals.t('cart'),
        cart: { items: [] },
        needsLogin: err.status === 401,
        errorMsg: err.message || res.locals.t('errorGeneric'),
      });
    }

    res.render('cart', {
      title: res.locals.t('cart'),
      cart,
      needsLogin: false,
    });
  });

  router.post('/:locale/cart/update', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      await authedFetch(req, res, '/api/cart/update', {
        method: 'PUT',
        body: {
          productId: req.body.productId,
          quantity: Number(req.body.quantity) || 1,
          variantId: req.body.variantId || undefined,
        },
      });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/cart`));
  });

  router.post('/:locale/cart/remove', requireAuth, async (req, res) => {
    const locale = req.locale;
    const productId = encodeURIComponent(req.body.productId || '');
    const qs = req.body.variantId ? `?variantId=${encodeURIComponent(req.body.variantId)}` : '';
    try {
      await authedFetch(req, res, `/api/cart/remove/${productId}${qs}`, { method: 'DELETE' });
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

  router.post('/:locale/cart/points', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      await authedFetch(req, res, '/api/cart/apply-ob-points', {
        method: 'POST',
        body: { points: Number(req.body.points) || 0 },
      });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/cart`));
  });
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

module.exports = { mountCart, normalizeCart };
