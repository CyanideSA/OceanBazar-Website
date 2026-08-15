import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { generateEntityId } from '../utils/hexId';
import { sendBusinessInquiryAlert } from '../services/emailService';
import { MAIL_BUSINESS } from '../config/mailAddresses';

const router = Router();

/** POST /api/business-inquiries — public storefront form */
router.post('/', async (req: Request, res: Response) => {
  try {
    const fullName = String(req.body.fullName || req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim() || null;
    const businessName = String(req.body.businessName || req.body.company || '').trim() || null;
    const businessType = String(req.body.businessType || '').trim() || null;
    const country = String(req.body.country || 'Bangladesh').trim() || null;
    const message = String(req.body.message || '').trim();

    if (!fullName || !email || !message) {
      res.status(400).json({ error: 'name, email, and message are required' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    // #region agent log
    try {
      const fs = await import('fs');
      const path = await import('path');
      const logPath = path.resolve(__dirname, '../../../debug-1eb282.log');
      fs.appendFileSync(
        logPath,
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'pre-fix',
          hypothesisId: 'H5',
          location: 'businessInquiries.ts:POST',
          message: 'business inquiry create',
          data: { hasName: !!fullName, hasEmail: !!email, businessType, notify: MAIL_BUSINESS },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion

    const created = await prisma.business_inquiries.create({
      data: {
        id: generateEntityId(),
        full_name: fullName.slice(0, 255),
        business_name: businessName ? businessName.slice(0, 255) : null,
        email: email.slice(0, 255),
        phone: phone ? phone.slice(0, 50) : null,
        business_type: businessType ? businessType.slice(0, 100) : null,
        country: country ? country.slice(0, 100) : null,
        message,
        status: 'pending',
      },
    });

    // Always notify OceanBazar Business mailbox (settings override only as CC target if different).
    let notifyTo = MAIL_BUSINESS;
    try {
      const settings = await prisma.site_settings.findFirst({
        select: { business_inquiry_email: true },
      });
      const configured = String(settings?.business_inquiry_email || '').trim().toLowerCase();
      if (configured && configured.includes('@')) notifyTo = configured;
    } catch { /* use default */ }

    void sendBusinessInquiryAlert(notifyTo, {
      fullName,
      email,
      phone,
      businessName,
      businessType,
      country,
      message,
      inquiryId: created.id,
    }).catch(() => undefined);

    res.status(201).json({
      ok: true,
      inquiryId: created.id,
      message: 'Inquiry submitted',
      businessEmail: MAIL_BUSINESS,
    });
  } catch (err: any) {
    console.error('[business-inquiries]', err);
    res.status(500).json({ error: err?.message || 'Failed to submit inquiry' });
  }
});

export default router;
