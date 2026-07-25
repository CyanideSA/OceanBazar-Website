const { authedFetch, requireAuth } = require('../session');
const { unwrapList } = require('../helpers');
const { bp } = require('../config');

function mountAccount(router) {
  router.get('/:locale/account', requireAuth, (req, res) => {
    res.render('account', {
      title: res.locals.t('account'),
    });
  });

  router.get('/:locale/account/orders', requireAuth, async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    let orders = [];
    try {
      const { data } = await authedFetch(req, res, '/api/orders', { query: { page } });
      orders = unwrapList(data, ['orders', 'items', 'data']);
      if (!orders.length && Array.isArray(data)) orders = data;
    } catch (err) {
      return res.render('orders', {
        title: res.locals.t('orders'),
        orders: [],
        errorMsg: err.message,
      });
    }
    res.render('orders', {
      title: res.locals.t('orders'),
      orders,
      page,
    });
  });

  router.get('/:locale/account/orders/:id', requireAuth, async (req, res) => {
    let order = null;
    let tracking = null;
    try {
      const { data } = await authedFetch(req, res, `/api/orders/${encodeURIComponent(req.params.id)}`);
      order = data?.order || data;
    } catch (err) {
      return res.status(404).render('error', {
        title: '404',
        message: err.message || res.locals.t('errorGeneric'),
      });
    }
    try {
      const { data } = await authedFetch(
        req,
        res,
        `/api/orders/${encodeURIComponent(req.params.id)}/tracking`,
      );
      tracking = data;
    } catch {
      tracking = null;
    }
    res.render('order-detail', {
      title: `${res.locals.t('orders')} #${order.orderNumber || order.id}`,
      order,
      tracking,
    });
  });

  router.get('/:locale/account/addresses', requireAuth, async (req, res) => {
    let addresses = [];
    try {
      const { data } = await authedFetch(req, res, '/api/profile/addresses');
      addresses = unwrapList(data, ['addresses', 'data', 'items']);
      if (!addresses.length && Array.isArray(data)) addresses = data;
    } catch (err) {
      return res.render('addresses', {
        title: res.locals.t('addresses'),
        addresses: [],
        errorMsg: err.message,
      });
    }
    res.render('addresses', {
      title: res.locals.t('addresses'),
      addresses,
    });
  });

  router.post('/:locale/account/addresses', requireAuth, async (req, res) => {
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
          isDefault: String(req.body.isDefault || '') === '1',
        },
      });
    } catch (err) {
      return res.redirect(
        `${bp(`/${locale}/account/addresses`)}?error=${encodeURIComponent(err.message)}`,
      );
    }
    res.redirect(bp(`/${locale}/account/addresses`));
  });

  router.get('/:locale/track', (req, res) => {
    res.render('track', {
      title: res.locals.t('orderTracking'),
      result: null,
    });
  });

  router.post('/:locale/track', async (req, res) => {
    const orderNumber = String(req.body.orderNumber || '').trim();
    const phone = String(req.body.phone || '').trim();
    let result = null;
    let errorMsg = '';
    try {
      // Prefer authenticated tracking if logged in; otherwise try public
      const { data } = await authedFetch(req, res, '/api/orders/track-public', {
        method: 'POST',
        body: { orderNumber, phone },
      });
      result = data;
    } catch (err) {
      // If not authed, try without auth via bffGet pattern
      try {
        const { bffFetch } = require('../bffClient');
        const { data } = await bffFetch('/api/orders/track-public', {
          method: 'POST',
          body: { orderNumber, phone },
        });
        result = data;
      } catch (e2) {
        errorMsg = e2.message || err.message;
      }
    }
    res.render('track', {
      title: res.locals.t('orderTracking'),
      result,
      errorMsg,
      orderNumber,
      phone,
    });
  });
}

module.exports = { mountAccount };
