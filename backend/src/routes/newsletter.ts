import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
const router = Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email required' }); return;
  }

  let isFirst = true;
  try {
    const prior = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM email_logs
      WHERE to_address = ${email} AND template = 'newsletter_signup'
      LIMIT 1
    `;
    isFirst = prior.length === 0;
  } catch { /* treat as first */ }

  try {
    await prisma.$executeRaw`
      INSERT INTO email_logs (id, to_address, subject, template, status, created_at)
      VALUES (${uuidv4()}, ${email}, 'Newsletter signup', 'newsletter_signup', 'success', NOW())
    `;
  } catch { /* non-fatal */ }

  if (isFirst) {
    try {
      const { sendNewsletterWelcomeEmail } = await import('../services/emailService');
      sendNewsletterWelcomeEmail(email).catch(() => {});
    } catch { /* non-fatal */ }
  }

  res.json({ success: true, message: 'Subscribed successfully!' });
});

export default router;
