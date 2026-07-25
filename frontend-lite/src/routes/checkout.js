const { authedFetch, requireAuth } = require('../session');
const { normalizeCart } = require('./cart');
const { unwrapList } = require('../helpers');

function mountCheckout(router) {
  router.get('/:locale/checkout', requireAuth, async (req, res) => {
    const locale = req.locale;
    let cart = { items: [] };
    let addresses = [];

    try {
      const { data } = await authedFetch(req, res, '/api/cart');
      cart = normalizeCart(data);
    } catch (err) {
      return res.redirect(`/${locale}/cart?error=${encodeURIComponent(err.message)}`);
    }

    if (!cart.items.length) {
      return res.redirect(`/${locale}/cart`);
    }

    try {
      const { data } = await authedFetch(req, res, '/api/profile/addresses');
      addresses = unwrapList(data, ['addresses', 'data', 'items']);
      if (!addresses.length && Array.isArray(data)) addresses = data;
    } catch {
      addresses = [];
    }

    res.render('checkout', {
      title: res.locals.t('checkout'),
      cart,
      addresses,
      paymentMethod: req.query.payment || 'cod',
    });
  });

  router.post('/:locale/checkout/address', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      await authedFetch(req, res, '/api/profile/addresses', {
        method: 'POST',
        body: {
          name: req.body.name,
          phone: req.body.phone,
          addressLine1: req.body.addressLine || req.body.addressLine1,
          city: req.body.city,
          district: req.body.district,
          area: req.body.area,
          postalCode: req.body.postalCode,
          isDefault: true,
        },
      });
    } catch (err) {
      return res.redirect(`/${locale}/checkout?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(`/${locale}/checkout`);
  });

  router.post('/:locale/checkout/place', requireAuth, async (req, res) => {
    const locale = req.locale;
    const shippingAddressId = Number(req.body.shippingAddressId);
    const paymentMethod = String(req.body.paymentMethod || 'cod');
    const notes = String(req.body.notes || '').slice(0, 500);

    if (!shippingAddressId) {
      return res.redirect(
        `/${locale}/checkout?error=${encodeURIComponent('Select a shipping address')}`,
      );
    }

    let order;
    try {
      const { data } = await authedFetch(req, res, '/api/orders/place', {
        method: 'POST',
        body: { shippingAddressId, paymentMethod, notes },
      });
      order = data?.order || data;
    } catch (err) {
      return res.redirect(`/${locale}/checkout?error=${encodeURIComponent(err.message)}`);
    }

    const orderId = order?.id || order?.orderId;
    if (!orderId) {
      return res.redirect(`/${locale}/account/orders?flash=${encodeURIComponent(res.locals.t('orderPlaced'))}`);
    }

    if (paymentMethod === 'cod') {
      return res.redirect(
        `/${locale}/account/orders/${orderId}?flash=${encodeURIComponent(res.locals.t('orderPlaced'))}`,
      );
    }

    // Initiate online payment and redirect to gateway URL when present
    const pathByMethod = {
      sslcommerz: '/api/payments/sslcommerz/initiate',
      bkash: '/api/payments/bkash/initiate',
      nagad: '/api/payments/nagad/initiate',
      rocket: '/api/payments/rocket/initiate',
      upay: '/api/payments/upay/initiate',
    };
    const payPath = pathByMethod[paymentMethod];
    if (!payPath) {
      return res.redirect(`/${locale}/account/orders/${orderId}`);
    }

    try {
      const { data } = await authedFetch(req, res, payPath, {
        method: 'POST',
        body: { orderId },
      });
      const url =
        data?.url ||
        data?.GatewayPageURL ||
        data?.redirectUrl ||
        data?.bkashURL ||
        data?.paymentUrl;
      if (url) return res.redirect(url);
    } catch (err) {
      return res.redirect(
        `/${locale}/account/orders/${orderId}?error=${encodeURIComponent(err.message)}`,
      );
    }

    res.redirect(`/${locale}/account/orders/${orderId}`);
  });
}

module.exports = { mountCheckout };
