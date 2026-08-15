const { authedFetch, requireAuth } = require('../session');
const { normalizeCart } = require('./cart');
const { unwrapList } = require('../helpers');
const { bp } = require('../config');

function mountCheckout(router) {
  router.get('/:locale/checkout', requireAuth, async (req, res) => {
    const locale = req.locale;
    let cart = { items: [] };
    let addresses = [];
    let obBalance = { balance: 0, tier: 'Bronze' };
    let appliedOb = null;

    try {
      const { data } = await authedFetch(req, res, '/api/cart');
      cart = normalizeCart(data);
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent(err.message)}`);
    }

    const paymentReturn = String(req.query.payment || '');
    const retryOrderId = String(req.query.orderId || '');
    // Payment failure returns here — keep checkout visible for retry even if cart was cleared.
    if (!cart.items.length && !(paymentReturn && retryOrderId)) {
      return res.redirect(bp(`/${locale}/cart`));
    }

    try {
      const { data } = await authedFetch(req, res, '/api/profile/addresses');
      addresses = unwrapList(data, ['addresses', 'data', 'items']);
      if (!addresses.length && Array.isArray(data)) addresses = data;
    } catch {
      addresses = [];
    }

    try {
      const { data } = await authedFetch(req, res, '/api/ob-points/balance');
      obBalance = {
        balance: Number(data?.balance) || 0,
        tier: data?.tier || 'Bronze',
      };
    } catch {
      obBalance = { balance: 0, tier: 'Bronze' };
    }

    const cookiePts = Number(req.cookies?.ob_points_checkout || 0) || 0;
    if (cookiePts > 0) {
      try {
        const { data } = await authedFetch(req, res, '/api/cart/apply-ob-points', {
          method: 'POST',
          body: { points: cookiePts },
        });
        appliedOb = {
          points: Number(data?.points) || cookiePts,
          bdtDiscount: Number(data?.bdtDiscount) || 0,
        };
      } catch {
        appliedOb = null;
        res.clearCookie('ob_points_checkout', { path: '/' });
      }
    }

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(
        path.resolve(__dirname, '../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'avatar-ob',
          hypothesisId: 'H-LITE-CHECKOUT-OB',
          location: 'checkout.js:GET',
          message: 'lite checkout ob points state',
          data: {
            balance: obBalance.balance,
            applied: Boolean(appliedOb),
            appliedPts: appliedOb?.points || 0,
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion

    res.render('checkout', {
      title: res.locals.t('checkout'),
      cart,
      addresses,
      paymentMethod:
        String(req.query.purpose || '') === 'delivery_fee'
          ? 'cod'
          : (String(req.query.method || '') === 'sslcommerz' ? 'sslcommerz' : 'cod'),
      obBalance,
      appliedOb,
      paymentRetry: paymentReturn && retryOrderId
        ? {
            payment: paymentReturn,
            orderId: retryOrderId,
            method: String(req.query.method || 'sslcommerz'),
            purpose: String(req.query.purpose || 'order_total'),
          }
        : null,
    });
  });

  router.post('/:locale/checkout/points', requireAuth, async (req, res) => {
    const locale = req.locale;
    const points = Math.max(0, Math.round(Number(req.body.points) || 0));
    if (!points) {
      res.clearCookie('ob_points_checkout', { path: '/' });
      return res.redirect(bp(`/${locale}/checkout`));
    }
    try {
      await authedFetch(req, res, '/api/cart/apply-ob-points', {
        method: 'POST',
        body: { points },
      });
      res.cookie('ob_points_checkout', String(points), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
        path: '/',
      });
    } catch (err) {
      res.clearCookie('ob_points_checkout', { path: '/' });
      return res.redirect(`${bp(`/${locale}/checkout`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/checkout`));
  });

  router.post('/:locale/checkout/address', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      await authedFetch(req, res, '/api/profile/addresses', {
        method: 'POST',
        body: {
          label: req.body.label || req.body.name || 'Home',
          line1: req.body.line1 || req.body.addressLine || req.body.addressLine1,
          line2: req.body.line2 || '',
          pathaoCityId: Number(req.body.pathaoCityId) || undefined,
          pathaoZoneId: Number(req.body.pathaoZoneId) || undefined,
          pathaoAreaId: Number(req.body.pathaoAreaId) || undefined,
          pathaoCityName: req.body.pathaoCityName,
          pathaoZoneName: req.body.pathaoZoneName,
          pathaoAreaName: req.body.pathaoAreaName,
          city: req.body.pathaoCityName || req.body.city,
          district: req.body.pathaoZoneName || req.body.district || req.body.area,
          postalCode: req.body.postalCode,
          isDefault: true,
        },
      });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/checkout`)}?error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(bp(`/${locale}/checkout`));
  });

  router.post('/:locale/checkout/retry-pay', requireAuth, async (req, res) => {
    const locale = req.locale;
    const orderId = String(req.body.orderId || '').trim();
    const purpose = String(req.body.purpose || '') === 'delivery_fee' ? 'delivery_fee' : 'order_total';
    if (!orderId) {
      return res.redirect(`${bp(`/${locale}/checkout`)}?error=${encodeURIComponent('Missing order for payment retry')}`);
    }
    try {
      const { data } = await authedFetch(req, res, '/api/payments/sslcommerz/initiate', {
        method: 'POST',
        body: { orderId, storefront: 'lite', locale, purpose },
      });
      const gatewayUrl =
        data?.data || data?.url || data?.GatewayPageURL || data?.redirectUrl || data?.paymentUrl;
      if (!gatewayUrl) throw new Error('Payment gateway URL missing');
      let embedScriptUrl = 'https://sandbox.sslcommerz.com/embed.min.js';
      try {
        const cfg = await authedFetch(req, res, '/api/payments/sslcommerz/config');
        if (cfg?.data?.embedScriptUrl) embedScriptUrl = cfg.data.embedScriptUrl;
      } catch { /* sandbox default */ }
      return res.render('checkout-ssl-pay', {
        title: purpose === 'delivery_fee' ? 'Pay delivery fee' : res.locals.t('payNow'),
        orderId,
        gatewayUrl,
        logo: data?.logo || '',
        embedScriptUrl,
        apiPublicUrl:
          process.env.NEXT_PUBLIC_API_URL
          || process.env.API_PUBLIC_URL
          || 'https://api.oceanbazar.com.bd',
        layout: false,
      });
    } catch (err) {
      return res.redirect(
        `${bp(`/${locale}/checkout`)}?payment=failed&orderId=${encodeURIComponent(orderId)}&method=sslcommerz&purpose=${encodeURIComponent(purpose)}&error=${encodeURIComponent(err.message)}`,
      );
    }
  });

  router.post('/:locale/checkout/place', requireAuth, async (req, res) => {
    const locale = req.locale;
    const shippingAddressId = Number(req.body.shippingAddressId);
    const paymentMethod = String(req.body.paymentMethod || 'cod');
    const notes = String(req.body.notes || '').slice(0, 500);
    const fromBody = Math.max(0, Math.round(Number(req.body.obPointsToRedeem) || 0));
    const fromCookie = Math.max(0, Math.round(Number(req.cookies?.ob_points_checkout) || 0));
    const obPointsToRedeem = fromBody || fromCookie;

    if (!shippingAddressId) {
      return res.redirect(
        `${bp(`/${locale}/checkout`)}?error=${encodeURIComponent('Select a shipping address')}`,
      );
    }

    if (String(req.body.agreePolicies || '') !== '1') {
      return res.redirect(
        `${bp(`/${locale}/checkout`)}?error=${encodeURIComponent('Please agree to the Terms, Privacy, and Refund policies')}`,
      );
    }

    let order;
    let requiresPayment = false;
    let paymentPurpose = 'order_total';
    try {
      const { data } = await authedFetch(req, res, '/api/orders/place', {
        method: 'POST',
        body: { shippingAddressId, paymentMethod, notes, obPointsToRedeem },
      });
      order = data?.order || data;
      requiresPayment = Boolean(data?.requiresPayment);
      paymentPurpose = data?.paymentPurpose === 'delivery_fee' ? 'delivery_fee' : 'order_total';
      res.clearCookie('ob_points_checkout', { path: '/' });
    } catch (err) {
      return res.redirect(`${bp(`/${locale}/checkout`)}?error=${encodeURIComponent(err.message)}`);
    }

    const orderId = order?.id || order?.orderId;
    if (!orderId) {
      return res.redirect(
        `${bp(`/${locale}/account/orders`)}?flash=${encodeURIComponent(res.locals.t('orderPlaced'))}`,
      );
    }

    // Free-shipping pay later: no SSL. Otherwise EasyCheckout (full total or delivery fee).
    if (paymentMethod === 'cod' && !requiresPayment) {
      return res.redirect(
        `${bp(`/${locale}/account/orders/${orderId}`)}?flash=${encodeURIComponent(res.locals.t('orderPlaced'))}`,
      );
    }

    const purpose =
      paymentMethod === 'cod' || paymentPurpose === 'delivery_fee' ? 'delivery_fee' : 'order_total';

    try {
      const { data } = await authedFetch(req, res, '/api/payments/sslcommerz/initiate', {
        method: 'POST',
        body: { orderId, storefront: 'lite', locale, purpose },
      });
      const gatewayUrl =
        data?.data ||
        data?.url ||
        data?.GatewayPageURL ||
        data?.redirectUrl ||
        data?.paymentUrl;
      if (gatewayUrl) {
        let embedScriptUrl = 'https://sandbox.sslcommerz.com/embed.min.js';
        try {
          const cfg = await authedFetch(req, res, '/api/payments/sslcommerz/config');
          if (cfg?.data?.embedScriptUrl) embedScriptUrl = cfg.data.embedScriptUrl;
        } catch { /* use sandbox default */ }
        return res.render('checkout-ssl-pay', {
          title: purpose === 'delivery_fee' ? 'Pay delivery fee' : res.locals.t('payNow'),
          orderId,
          gatewayUrl,
          logo: data?.logo || '',
          embedScriptUrl,
          apiPublicUrl:
            process.env.NEXT_PUBLIC_API_URL
            || process.env.API_PUBLIC_URL
            || 'https://api.oceanbazar.com.bd',
          layout: false,
        });
      }
    } catch (err) {
      return res.redirect(
        `${bp(`/${locale}/checkout`)}?payment=failed&orderId=${encodeURIComponent(orderId)}&method=sslcommerz&purpose=${encodeURIComponent(purpose)}&error=${encodeURIComponent(err.message)}`,
      );
    }

    res.redirect(
      `${bp(`/${locale}/checkout`)}?payment=failed&orderId=${encodeURIComponent(orderId)}&method=sslcommerz&purpose=${encodeURIComponent(purpose)}`,
    );
  });
}

module.exports = { mountCheckout };
