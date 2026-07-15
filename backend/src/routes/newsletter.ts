import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { sendMail, emailWrapper } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

const SUBSCRIBER_KEY = 'newsletter_subscribers';

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email required' }); return;
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO email_logs (id, to_address, subject, template, status, created_at)
      VALUES (${uuidv4()}, ${email}, 'Newsletter signup', 'newsletter_signup', 'success', NOW())
    `;
  } catch { /* non-fatal */ }

  // Send welcome email
  try {
    const body = `
      <h2 style="margin:0 0 12px;color:#111827;">Welcome to OceanBazar! 🌊</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">
        Thanks for subscribing to our newsletter. You'll be the first to hear about exclusive deals,
        flash sales, and new arrivals.
      </p>
      <p style="color:#6b7280;font-size:13px;margin-top:16px;">
        To unsubscribe at any time, simply reply to this email with "UNSUBSCRIBE".
      </p>`;
    sendMail(email, '🌊 Welcome to OceanBazar Newsletter', emailWrapper(body), 'newsletter_welcome').catch(() => {});
  } catch { /* non-fatal */ }

  res.json({ success: true, message: 'Subscribed successfully!' });
});

export default router;
