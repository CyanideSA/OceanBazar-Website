import { Router, type Request, type Response } from 'express';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { apiLimiter } from '../middleware/rateLimiter';
import { emitToRoom } from '../lib/adminEvents';
import { appLog } from '../lib/appLog';
import { prisma } from '../lib/prisma';

const router = Router();

const MAX_LEN = {
  digest: 128,
  message: 4000,
  stack: 12000,
  url: 2048,
  userAgent: 512,
  locale: 8,
};

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function ipHash(req: Request): string | undefined {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip;
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 64);
}

/** POST /api/client-errors — public, rate-limited storefront error snapshots */
router.post('/', apiLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const digest = clip(body.digest, MAX_LEN.digest);
    const message = clip(body.message, MAX_LEN.message);
    const stack = clip(body.stack, MAX_LEN.stack);
    const url = clip(body.url, MAX_LEN.url);
    const userAgent = clip(body.userAgent ?? req.headers['user-agent'], MAX_LEN.userAgent);
    const locale = clip(body.locale, MAX_LEN.locale);

    let snapshot: Record<string, unknown> | undefined;
    if (body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot)) {
      snapshot = body.snapshot as Record<string, unknown>;
    }

    let userId: string | undefined;
    const rawUserId = clip(body.userId, 8);
    if (rawUserId && /^[A-Za-z0-9]{8}$/.test(rawUserId) && !rawUserId.startsWith('visitor')) {
      userId = rawUserId;
    }

    if (!digest && !message && !stack && !snapshot) {
      res.status(400).json({ error: 'Nothing to report' });
      return;
    }

    const report = await prisma.clientErrorReport.create({
      data: {
        digest: digest ?? null,
        message: message ?? null,
        stack: stack ?? null,
        url: url ?? null,
        userAgent: userAgent ?? null,
        locale: locale ?? null,
        snapshot: (snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
        ipHash: ipHash(req) ?? null,
        userId: userId ?? null,
      },
    });

    emitToRoom('admin:crm', 'client-error:new', {
      id: report.id,
      digest: report.digest,
      message: report.message,
      url: report.url,
      createdAt: report.createdAt,
    });

    appLog('warn', 'client_error_report', {
      requestId: req.requestId,
      id: report.id,
      digest: report.digest,
      url: report.url,
    });

    res.status(201).json({ id: report.id, ok: true });
  } catch (err) {
    appLog('error', 'client_error_report_failed', { error: String(err) });
    res.status(500).json({ error: 'Failed to record error report' });
  }
});

export default router;
