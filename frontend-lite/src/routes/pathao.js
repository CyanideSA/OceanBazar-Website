const { authedFetch, requireAuth } = require('../session');
const { bffGet } = require('../bffClient');

function mountPathao(router) {
  router.get('/:locale/pathao/cities', async (req, res) => {
    try {
      const data = await bffGet('/api/delivery/pathao/cities');
      res.json(data || { cities: [] });
    } catch (err) {
      res.status(502).json({ error: err.message || 'Failed to load cities' });
    }
  });

  router.get('/:locale/pathao/zones/:cityId', async (req, res) => {
    try {
      const data = await bffGet(`/api/delivery/pathao/zones/${encodeURIComponent(req.params.cityId)}`);
      res.json(data || { zones: [] });
    } catch (err) {
      res.status(502).json({ error: err.message || 'Failed to load zones' });
    }
  });

  router.get('/:locale/pathao/areas/:zoneId', async (req, res) => {
    try {
      const data = await bffGet(`/api/delivery/pathao/areas/${encodeURIComponent(req.params.zoneId)}`);
      res.json(data || { areas: [] });
    } catch (err) {
      res.status(502).json({ error: err.message || 'Failed to load areas' });
    }
  });

  router.post('/:locale/pathao/quote', requireAuth, async (req, res) => {
    try {
      const { data } = await authedFetch(req, res, '/api/delivery/pathao/quote', {
        method: 'POST',
        body: {
          shippingAddressId: Number(req.body.shippingAddressId) || undefined,
          pathaoCityId: Number(req.body.pathaoCityId) || undefined,
          pathaoZoneId: Number(req.body.pathaoZoneId) || undefined,
          itemCount: Number(req.body.itemCount) || undefined,
        },
      });
      // #region agent log
      try {
        const fs = require('fs');
        const path = require('path');
        fs.appendFileSync(
          path.resolve(__dirname, '../../../debug-e24651.log'),
          `${JSON.stringify({
            sessionId: 'e24651',
            runId: 'lite-quote',
            hypothesisId: 'H2',
            location: 'pathao.js:quote',
            message: 'lite pathao quote',
            data: { price: data?.quote?.price, addr: req.body.shippingAddressId },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      res.json(data || {});
    } catch (err) {
      res.status(502).json({ error: err.message || 'Quote failed' });
    }
  });
}

module.exports = { mountPathao };
