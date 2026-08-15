const { authedFetch, requireAuth, readTokens } = require('../session');
const { BFF_BASE, BffError } = require('../bffClient');
const { unwrapList } = require('../helpers');
const { bp } = require('../config');

function mountAccount(router) {
  router.get('/:locale/account', requireAuth, async (req, res) => {
    let recentOrders = [];
    let totalOrders = 0;
    try {
      const { data } = await authedFetch(req, res, '/api/orders', { query: { page: 1 } });
      const list = unwrapList(data, ['orders', 'items', 'data']);
      recentOrders = (Array.isArray(list) ? list : []).slice(0, 3);
      totalOrders =
        (data && (data.total || data.totalCount || data.count)) ||
        (Array.isArray(list) ? list.length : 0);
    } catch {
      recentOrders = [];
      totalOrders = 0;
    }
    res.render('account', {
      title: res.locals.t('account'),
      recentOrders,
      totalOrders,
      queryFlash: String(req.query.flash || ''),
      queryError: String(req.query.error || ''),
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
    let survey = null;
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
    try {
      const { data } = await authedFetch(
        req,
        res,
        `/api/orders/${encodeURIComponent(req.params.id)}/survey`,
      );
      survey = data;
    } catch {
      survey = null;
    }
    res.render('order-detail', {
      title: `${res.locals.t('orders')} #${order.orderNumber || order.id}`,
      order,
      tracking,
      survey,
      openSurvey: String(req.query.survey || '') === '1',
      surveyNotice: String(req.query.notice || ''),
      surveyError: String(req.query.error || ''),
    });
  });

  router.post('/:locale/account/orders/:id/survey', requireAuth, async (req, res) => {
    const locale = req.locale;
    const id = req.params.id;
    const dest = bp(`/${locale}/account/orders/${id}`);
    try {
      await authedFetch(req, res, `/api/orders/${encodeURIComponent(id)}/survey`, {
        method: 'POST',
        body: {
          productSatisfaction: Number(req.body.productSatisfaction),
          serviceSatisfaction: Number(req.body.serviceSatisfaction),
          paymentConvenience: Number(req.body.paymentConvenience),
          codExperience: req.body.codExperience ? Number(req.body.codExperience) : null,
          deliveryExperience: Number(req.body.deliveryExperience),
          comments: String(req.body.comments || '').trim(),
        },
      });
      return res.redirect(
        `${dest}?survey=1&notice=${encodeURIComponent(res.locals.t('surveyContinue') || 'Continue to product reviews')}`,
      );
    } catch (err) {
      return res.redirect(
        `${dest}?survey=1&error=${encodeURIComponent(err.message || res.locals.t('errorGeneric'))}`,
      );
    }
  });

  router.get('/:locale/account/orders/:id/invoice', requireAuth, async (req, res) => {
    let order = null;
    try {
      const { data } = await authedFetch(req, res, `/api/orders/${encodeURIComponent(req.params.id)}`);
      order = data?.order || data;
    } catch (err) {
      return res.status(404).render('error', {
        title: '404',
        message: err.message || res.locals.t('errorGeneric'),
      });
    }
    res.render('invoice', {
      title: `${res.locals.t('invoice')} #${order.orderNumber || order.id}`,
      order,
      hideChrome: true,
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

  router.post('/:locale/account/photo', requireAuth, async (req, res) => {
    const locale = req.locale;
    const dest = bp(`/${locale}/account`);
    const { accessToken, refreshToken } = readTokens(req);
    if (!accessToken && !refreshToken) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(dest)}`,
      );
    }
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().includes('multipart/form-data')) {
      return res.redirect(
        `${dest}?error=${encodeURIComponent(res.locals.t('photoRequired') || 'Choose a photo to upload')}`,
      );
    }
    try {
      const headers = {
        Accept: 'application/json',
        'X-Requested-With': 'oceanbazar-lite',
        'Content-Type': ct,
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (refreshToken) {
        headers.Cookie = `refreshToken=${refreshToken}`;
        headers['X-Refresh-Token'] = refreshToken;
      }
      const upstream = await fetch(`${BFF_BASE}/api/upload/profile-photo`, {
        method: 'POST',
        headers,
        body: req,
        duplex: 'half',
      });
      const text = await upstream.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!upstream.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          `Upload failed (${upstream.status})`;
        throw new BffError(upstream.status, String(msg), data);
      }
      // #region agent log
      try {
        const fs = require('fs');
        const pathMod = require('path');
        fs.appendFileSync(
          pathMod.resolve(__dirname, '../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'lite-parity',
            hypothesisId: 'H-LITE-PHOTO',
            location: 'account.js:account/photo',
            message: 'lite profile photo uploaded',
            data: { ok: true, hasUrl: !!(data && data.url) },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      return res.redirect(
        `${dest}?flash=${encodeURIComponent(res.locals.t('photoUpdated') || 'Profile photo updated')}`,
      );
    } catch (err) {
      return res.redirect(
        `${dest}?error=${encodeURIComponent(err.message || res.locals.t('errorGeneric'))}`,
      );
    }
  });

  router.post('/:locale/account/addresses', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      await authedFetch(req, res, '/api/profile/addresses', {
        method: 'POST',
        body: {
          label: req.body.label || req.body.name,
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
