const crypto = require('crypto');
const { bffFetch } = require('../bffClient');
const { authedFetch, requireAuth, readTokens } = require('../session');
const { unwrapList } = require('../helpers');
const { bp } = require('../config');

const VISITOR_COOKIE = 'ob_lite_visitor';

function visitorCookieOpts() {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.TRUST_PROXY === '1';
  const domain = (process.env.COOKIE_DOMAIN || '').trim() || undefined;
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 30 * 86400 * 1000,
    ...(domain ? { domain } : {}),
  };
}

function getOrCreateVisitorId(req, res) {
  let id = String(req.cookies?.[VISITOR_COOKIE] || '').trim();
  if (!id || !/^visitor-[a-zA-Z0-9]+$/.test(id)) {
    id = `visitor-${crypto.randomBytes(10).toString('hex')}`;
    res.cookie(VISITOR_COOKIE, id, visitorCookieOpts());
  }
  return id;
}

async function optionalAuthedFetch(req, res, path, opts = {}) {
  const { accessToken, refreshToken } = readTokens(req);
  if (accessToken || refreshToken) {
    try {
      return await authedFetch(req, res, path, opts);
    } catch (err) {
      if (err && err.status === 401) {
        return bffFetch(path, opts);
      }
      throw err;
    }
  }
  return bffFetch(path, opts);
}

function flashRedirect(res, path, opts = {}) {
  const q = new URLSearchParams();
  if (opts.flash) q.set('flash', opts.flash);
  if (opts.error) q.set('error', opts.error);
  const qs = q.toString();
  return res.redirect(qs ? `${path}?${qs}` : path);
}

function mountServices(router) {
  // ── Live chat (guest OK, poll-friendly SSR) ───────────────────────────────
  router.get('/:locale/chat', async (req, res) => {
    const locale = req.locale;
    const visitorId = getOrCreateVisitorId(req, res);
    let session = null;
    try {
      const { accessToken } = readTokens(req);
      const query = accessToken ? {} : { visitorId };
      const { data } = await optionalAuthedFetch(req, res, '/api/chat/session', { query });
      session = data?.session || null;
    } catch {
      session = null;
    }
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    res.render('chat', {
      title: res.locals.t('liveChat'),
      session,
      messages,
      visitorId,
      poll: Boolean(session && session.is_active !== false && session.status !== 'finished'),
    });
  });

  router.post('/:locale/chat/start', async (req, res) => {
    const locale = req.locale;
    const visitorId = getOrCreateVisitorId(req, res);
    const name = String(req.body.name || '').trim() || (req.user && req.user.name) || 'Guest';
    const email = String(req.body.email || '').trim();
    const phone = String(req.body.phone || '').trim();
    const issue = String(req.body.issue || '').trim() || 'general';
    const details = String(req.body.details || '').trim();
    try {
      const { data } = await optionalAuthedFetch(req, res, '/api/chat/start', {
        method: 'POST',
        body: { name, email, phone, issue, visitorId },
      });
      const session = data?.session;
      if (details && session?.id) {
        await optionalAuthedFetch(req, res, '/api/chat/message', {
          method: 'POST',
          body: { sessionId: session.id, message: details, visitorId },
        });
      }
      return res.redirect(bp(`/${locale}/chat`));
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/chat`), { error: err.message });
    }
  });

  router.post('/:locale/chat/message', async (req, res) => {
    const locale = req.locale;
    const visitorId = getOrCreateVisitorId(req, res);
    const message = String(req.body.message || '').trim();
    const sessionId = String(req.body.sessionId || '').trim();
    if (!message) return res.redirect(bp(`/${locale}/chat`));
    try {
      await optionalAuthedFetch(req, res, '/api/chat/message', {
        method: 'POST',
        body: { sessionId: sessionId || undefined, message, visitorId },
      });
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/chat`), { error: err.message });
    }
    return res.redirect(bp(`/${locale}/chat`));
  });

  router.post('/:locale/chat/escalate', async (req, res) => {
    const locale = req.locale;
    const visitorId = getOrCreateVisitorId(req, res);
    const sessionId = String(req.body.sessionId || '').trim();
    try {
      await optionalAuthedFetch(req, res, '/api/chat/escalate', {
        method: 'POST',
        body: { sessionId, visitorId },
      });
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/chat`), { error: err.message });
    }
    return flashRedirect(res, bp(`/${locale}/chat`), { flash: res.locals.t('chatEscalated') });
  });

  router.post('/:locale/chat/close', async (req, res) => {
    const locale = req.locale;
    const visitorId = getOrCreateVisitorId(req, res);
    const sessionId = String(req.body.sessionId || '').trim();
    try {
      await optionalAuthedFetch(req, res, '/api/chat/session/close', {
        method: 'POST',
        body: { sessionId: sessionId || undefined, visitorId },
      });
    } catch {
      /* ignore */
    }
    return res.redirect(bp(`/${locale}/chat`));
  });

  /** JSON poll for low-end AJAX refresh (no full page reload). */
  router.get('/:locale/chat/poll', async (req, res) => {
    const visitorId = getOrCreateVisitorId(req, res);
    try {
      const { accessToken } = readTokens(req);
      const query = accessToken ? {} : { visitorId };
      const { data } = await optionalAuthedFetch(req, res, '/api/chat/session', { query });
      const session = data?.session || null;
      const messages = Array.isArray(session?.messages) ? session.messages : [];
      res.json({
        ok: true,
        session: session
          ? {
              id: session.id,
              status: session.status,
              agent_name: session.agent_name || null,
              is_active: session.is_active,
            }
          : null,
        messages,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'poll failed' });
    }
  });

  router.post('/:locale/chat/action', async (req, res) => {
    const locale = req.locale;
    const visitorId = getOrCreateVisitorId(req, res);
    const sessionId = String(req.body.sessionId || '').trim();
    const action = String(req.body.action || '').trim();
    const productId = String(req.body.productId || '').trim();
    const payload = {};
    if (productId) payload.productId = productId;
    if (req.body.quantity) payload.quantity = Number(req.body.quantity) || 1;
    const wantsJson =
      String(req.headers.accept || '').includes('application/json') ||
      String(req.headers['x-requested-with'] || '') === 'oceanbazar-lite-ajax';
    try {
      // #region agent log
      try {
        const fs = require('fs');
        const path = require('path');
        fs.appendFileSync(
          path.resolve(__dirname, '../../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'pre-fix',
            hypothesisId: 'H6',
            location: 'services.js:chat/action',
            message: 'lite chat action',
            data: { action, hasProductId: Boolean(productId), sessionId: sessionId.slice(0, 12) },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      await optionalAuthedFetch(req, res, '/api/chat/action', {
        method: 'POST',
        body: { sessionId, action, visitorId, payload },
      });
      if (wantsJson) return res.json({ ok: true });
      return res.redirect(bp(`/${locale}/chat`));
    } catch (err) {
      if (wantsJson) return res.status(400).json({ ok: false, error: err.message });
      return flashRedirect(res, bp(`/${locale}/chat`), { error: err.message });
    }
  });

  // ── Support tickets ───────────────────────────────────────────────────────
  router.get('/:locale/tickets', requireAuth, async (req, res) => {
    let tickets = [];
    try {
      const { data } = await authedFetch(req, res, '/api/tickets');
      tickets = unwrapList(data, ['tickets', 'data', 'items']);
      if (!tickets.length && Array.isArray(data)) tickets = data;
    } catch (err) {
      return res.render('tickets', {
        title: res.locals.t('supportTickets'),
        tickets: [],
        errorMsg: err.message,
      });
    }
    res.render('tickets', {
      title: res.locals.t('supportTickets'),
      tickets,
    });
  });

  router.post('/:locale/tickets', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      const { data } = await authedFetch(req, res, '/api/tickets', {
        method: 'POST',
        body: {
          subject: String(req.body.subject || '').trim(),
          message: String(req.body.message || '').trim(),
          category: String(req.body.category || 'other').trim(),
          priority: String(req.body.priority || 'medium').trim(),
          orderId: String(req.body.orderId || '').trim() || undefined,
        },
      });
      const id = data?.ticket?.id || data?.id;
      if (id) return res.redirect(bp(`/${locale}/tickets/${encodeURIComponent(id)}`));
      return flashRedirect(res, bp(`/${locale}/tickets`), { flash: res.locals.t('ticketCreated') });
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/tickets`), { error: err.message });
    }
  });

  router.get('/:locale/tickets/:id', requireAuth, async (req, res) => {
    try {
      const { data } = await authedFetch(req, res, `/api/tickets/${encodeURIComponent(req.params.id)}`);
      const ticket = data?.ticket || data;
      try {
        await authedFetch(req, res, `/api/tickets/${encodeURIComponent(req.params.id)}/seen`, {
          method: 'POST',
          body: {},
        });
      } catch {
        /* optional */
      }
      res.render('ticket-detail', {
        title: ticket.subject || res.locals.t('supportTickets'),
        ticket,
      });
    } catch (err) {
      return res.status(404).render('error', {
        title: '404',
        message: err.message || res.locals.t('errorGeneric'),
      });
    }
  });

  router.post('/:locale/tickets/:id/messages', requireAuth, async (req, res) => {
    const locale = req.locale;
    const id = req.params.id;
    try {
      await authedFetch(req, res, `/api/tickets/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: { message: String(req.body.message || '').trim() },
      });
      return res.redirect(bp(`/${locale}/tickets/${encodeURIComponent(id)}`));
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/tickets/${encodeURIComponent(id)}`), {
        error: err.message,
      });
    }
  });

  // ── Returns & refunds ─────────────────────────────────────────────────────
  router.get('/:locale/returns', requireAuth, async (req, res) => {
    let returns = [];
    let orders = [];
    try {
      const { data } = await authedFetch(req, res, '/api/returns');
      returns = unwrapList(data, ['returns', 'data', 'items']);
      if (!returns.length && Array.isArray(data)) returns = data;
    } catch (err) {
      return res.render('returns', {
        title: res.locals.t('returnsRefunds'),
        returns: [],
        orders: [],
        errorMsg: err.message,
      });
    }
    try {
      const { data } = await authedFetch(req, res, '/api/orders', { query: { page: 1, limit: 30 } });
      orders = unwrapList(data, ['orders', 'items', 'data']);
    } catch {
      orders = [];
    }
    res.render('returns', {
      title: res.locals.t('returnsRefunds'),
      returns,
      orders,
    });
  });

  router.post('/:locale/returns', requireAuth, async (req, res) => {
    const locale = req.locale;
    try {
      const { data } = await authedFetch(req, res, '/api/returns', {
        method: 'POST',
        body: {
          orderId: String(req.body.orderId || '').trim(),
          reason: String(req.body.reason || '').trim(),
          reasonCategory: String(req.body.reasonCategory || req.body.reason || '').trim() || undefined,
          description: String(req.body.description || '').trim() || undefined,
        },
      });
      const id = data?.returnRequest?.id || data?.id;
      if (id) return res.redirect(bp(`/${locale}/returns/${encodeURIComponent(id)}`));
      return flashRedirect(res, bp(`/${locale}/returns`), { flash: res.locals.t('returnSubmitted') });
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/returns`), { error: err.message });
    }
  });

  router.get('/:locale/returns/:id', requireAuth, async (req, res) => {
    try {
      const { data } = await authedFetch(req, res, `/api/returns/${encodeURIComponent(req.params.id)}`);
      const returnRequest = data?.returnRequest || data;
      const refundRecords = data?.refundRecords || [];
      res.render('return-detail', {
        title: res.locals.t('returnsRefunds'),
        returnRequest,
        refundRecords,
      });
    } catch (err) {
      return res.status(404).render('error', {
        title: '404',
        message: err.message || res.locals.t('errorGeneric'),
      });
    }
  });

  router.post('/:locale/returns/:id/refund-account', requireAuth, async (req, res) => {
    const locale = req.locale;
    const id = req.params.id;
    try {
      await authedFetch(req, res, `/api/returns/${encodeURIComponent(id)}/refund-account`, {
        method: 'POST',
        body: {
          method: String(req.body.method || 'bkash').trim(),
          accountNumber: String(req.body.accountNumber || '').trim(),
          accountName: String(req.body.accountName || '').trim() || undefined,
          bankName: String(req.body.bankName || '').trim() || undefined,
          branchName: String(req.body.branchName || '').trim() || undefined,
          notes: String(req.body.notes || '').trim() || undefined,
        },
      });
      return flashRedirect(res, bp(`/${locale}/returns/${encodeURIComponent(id)}`), {
        flash: res.locals.t('refundAccountSaved'),
      });
    } catch (err) {
      return flashRedirect(res, bp(`/${locale}/returns/${encodeURIComponent(id)}`), {
        error: err.message,
      });
    }
  });

  // ── OB Points ─────────────────────────────────────────────────────────────
  router.get('/:locale/account/points', requireAuth, async (req, res) => {
    let balance = null;
    let ledger = [];
    let tiers = null;
    try {
      const { data } = await authedFetch(req, res, '/api/ob-points/balance');
      balance = data;
    } catch (err) {
      return res.render('points', {
        title: res.locals.t('obPoints'),
        balance: null,
        ledger: [],
        tiers: null,
        errorMsg: err.message,
      });
    }
    try {
      const { data } = await authedFetch(req, res, '/api/ob-points/ledger', {
        query: { page: 1, limit: 20 },
      });
      ledger = unwrapList(data, ['entries', 'items', 'data']);
    } catch {
      ledger = [];
    }
    try {
      const { data } = await bffFetch('/api/ob-points/tiers');
      tiers = data;
    } catch {
      tiers = null;
    }
    res.render('points', {
      title: res.locals.t('obPoints'),
      balance,
      ledger,
      tiers,
    });
  });
}

module.exports = { mountServices };
