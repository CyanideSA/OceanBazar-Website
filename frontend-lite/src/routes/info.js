const { getPolicy, POLICY_ORDER, getPolicies } = require('../content/policies');
const { getPageCopy } = require('../content/pageCopy');
const { bffSend } = require('../bffClient');
const { bp } = require('../config');
const { authedFetch, requireAuth } = require('../session');

/** Temporary full prefer (4h) — do not exile low-end devices for a year. */
function fullSitePrefer(basePath, locale, fullPath) {
  const next = fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
  return `${basePath}/prefer?view=full&ttl=4h&next=${encodeURIComponent(next)}`;
}

function mountInfo(router) {
  router.get('/:locale/policies', (req, res) => {
    const locale = req.locale;
    const policies = getPolicies(locale);
    res.render('policies-index', {
      title: res.locals.t('legalSection'),
      policyOrder: POLICY_ORDER,
      policies,
    });
  });

  router.get('/:locale/policies/:slug', (req, res) => {
    const locale = req.locale;
    const doc = getPolicy(locale, req.params.slug);
    if (!doc) {
      return res.status(404).render('error', {
        title: '404',
        message: 'Policy not found',
      });
    }
    res.render('policy', {
      title: doc.title,
      doc,
      policyOrder: POLICY_ORDER,
      policies: getPolicies(locale),
      slug: req.params.slug,
    });
  });

  router.get('/:locale/marketing', (req, res) => {
    const copy = getPageCopy(req.locale, 'marketing');
    res.render('marketing', {
      title: copy.whyTitle || res.locals.t('whyOceanBazar'),
      copy,
    });
  });

  router.get('/:locale/contact', (req, res) => {
    const copy = getPageCopy(req.locale, 'contact');
    res.render('contact', {
      title: copy.title || res.locals.t('contactUs'),
      copy,
    });
  });

  router.get('/:locale/business-inquiries', (req, res) => {
    const copy = getPageCopy(req.locale, 'business');
    res.render('business', {
      title: copy.title || res.locals.t('businessInquiries'),
      copy,
      inquiryStatus: req.query.inquiry === 'ok' ? 'ok' : '',
    });
  });

  router.post('/:locale/business-inquiries', async (req, res) => {
    const locale = req.locale;
    const path = bp(`/${locale}/business-inquiries`);
    try {
      await bffSend('POST', '/api/business-inquiries', {
        name: String(req.body.name || '').trim(),
        email: String(req.body.email || '').trim(),
        company: String(req.body.company || '').trim(),
        phone: String(req.body.phone || '').trim(),
        businessType: String(req.body.businessType || '').trim(),
        message: String(req.body.message || '').trim(),
      });
      return res.redirect(`${path}?inquiry=ok&flash=${encodeURIComponent(res.locals.t('inquirySent') || 'Inquiry sent')}`);
    } catch (err) {
      return res.redirect(
        `${path}?error=${encodeURIComponent(err.message || res.locals.t('errorGeneric'))}`,
      );
    }
  });

  router.get('/:locale/support', (req, res) => {
    const copy = getPageCopy(req.locale, 'support');
    res.render('support', {
      title: copy.title || res.locals.t('supportCenter'),
      copy,
    });
  });

  router.get('/:locale/wholesale', (req, res) => {
    const status = String(req.query.apply || '');
    res.render('wholesale', {
      title: res.locals.t('wholesaleHub') || 'Wholesale Hub',
      applyStatus: status === 'ok' ? 'ok' : '',
      formError: String(req.query.error || ''),
    });
  });

  router.post('/:locale/wholesale', requireAuth, async (req, res) => {
    const locale = req.locale;
    const path = bp(`/${locale}/wholesale`);
    const businessName = String(req.body.businessName || '').trim();
    const tradeLicense = String(req.body.tradeLicense || '').trim();
    const address = String(req.body.address || '').trim();
    const contactPerson = String(req.body.contactPerson || '').trim();
    const email = String(req.body.email || '').trim();
    const phone = String(req.body.phone || '').trim();
    const notes = String(req.body.notes || '').trim();
    if (!businessName || !tradeLicense || !address) {
      return res.redirect(
        `${path}?error=${encodeURIComponent(res.locals.t('wholesaleRequired') || 'Business name, trade license, and address are required')}`,
      );
    }
    const notesPayload = [
      notes,
      contactPerson ? `Contact: ${contactPerson}` : '',
      email ? `Email: ${email}` : '',
      phone ? `Phone: ${phone}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await authedFetch(req, res, '/api/wholesale/apply', {
        method: 'POST',
        body: {
          businessName,
          tradeLicense,
          address,
          notes: notesPayload || undefined,
        },
      });
      try {
        const subject = businessName
          ? `[APP:WHOLESALE] Wholesale access application: ${businessName}`
          : '[APP:WHOLESALE] Wholesale access application';
        const message = [
          'Wholesale Hub Application',
          '',
          `Company Name: ${businessName || '—'}`,
          `Trade License: ${tradeLicense || '—'}`,
          `Contact Person: ${contactPerson || '—'}`,
          `Email: ${email || '—'}`,
          `Phone: ${phone || '—'}`,
          `Business Address: ${address || '—'}`,
          '',
          'Notes:',
          notes || '—',
        ].join('\n');
        await authedFetch(req, res, '/api/tickets', {
          method: 'POST',
          body: { subject, category: 'other', priority: 'medium', message },
        });
      } catch { /* mirror ticket is best-effort */ }
      // #region agent log
      try {
        const fs = require('fs');
        const pathMod = require('path');
        fs.appendFileSync(
          pathMod.resolve(__dirname, '../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'lite-parity',
            hypothesisId: 'H-LITE-WHOLESALE',
            location: 'info.js:wholesale',
            message: 'lite wholesale apply ok',
            data: { businessLen: businessName.length },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      return res.redirect(`${path}?apply=ok`);
    } catch (err) {
      return res.redirect(
        `${path}?error=${encodeURIComponent(err.message || res.locals.t('errorGeneric'))}`,
      );
    }
  });

  router.post('/:locale/newsletter/subscribe', async (req, res) => {
    const locale = req.locale;
    const email = String(req.body.email || '').trim();
    const fallback = bp(`/${locale}`);
    let redirectTo = String(req.body.returnTo || fallback).slice(0, 500);
    // Only allow same-app relative redirects
    if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
      redirectTo = fallback;
    }
    const sep = redirectTo.includes('?') ? '&' : '?';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.redirect(`${redirectTo}${sep}newsletter=error`);
    }
    try {
      await bffSend('POST', '/api/newsletter/subscribe', { email });
      return res.redirect(`${redirectTo}${sep}newsletter=ok`);
    } catch {
      return res.redirect(`${redirectTo}${sep}newsletter=error`);
    }
  });
}

module.exports = { mountInfo, fullSitePrefer };
