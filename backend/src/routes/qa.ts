import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let qaTableReady = false;

/**
 * Ensure the product_qa table (and all columns the admin moderation UI reads)
 * exists. Idempotent; safe to call before any product_qa query.
 */
export async function readyQaTable(): Promise<void> {
  if (qaTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_qa (
      id                TEXT PRIMARY KEY,
      product_id        VARCHAR(16) NOT NULL,
      user_id           VARCHAR(16),
      asker_name        VARCHAR(255),
      asker_email       VARCHAR(255),
      question          TEXT NOT NULL,
      answer            TEXT,
      answered_by_name  VARCHAR(255),
      image_urls        JSONB,
      answer_image_urls JSONB,
      status            VARCHAR(20) NOT NULL DEFAULT 'pending',
      is_approved       BOOLEAN NOT NULL DEFAULT FALSE,
      asked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at       TIMESTAMPTZ
    )
  `);
  // Backfill columns for databases created by an older revision of this table.
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS answer TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS answered_by_name VARCHAR(255)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS image_urls JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS answer_image_urls JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_product_qa_product ON product_qa(product_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_product_qa_status ON product_qa(status, is_approved)`);
  qaTableReady = true;
}

// GET /api/qa/:productId — list approved Q&As for a product
router.get('/:productId', async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  try {
    const items = await prisma.$queryRaw<any[]>`
      SELECT q.id, q.question, q.answer, q.asked_at, q.answered_at,
             u.name as asker_name
      FROM product_qa q
      LEFT JOIN users u ON u.id = q.user_id
      WHERE q.product_id = ${productId} AND q.is_approved = TRUE
      ORDER BY q.asked_at DESC
      LIMIT 20
    `;
    res.json({ qa: items });
  } catch {
    res.json({ qa: [] });
  }
});

// POST /api/qa/:productId — submit a question (public, email stored)
router.post('/:productId', async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  const { question, askerName, askerEmail } = req.body as {
    question: string; askerName?: string; askerEmail?: string;
  };
  if (!question || question.trim().length < 5) {
    res.status(400).json({ error: 'Question must be at least 5 characters' }); return;
  }
  try {
    const userId = (req as any).user?.userId ?? null;
    await prisma.$executeRaw`
      INSERT INTO product_qa (id, product_id, user_id, asker_name, asker_email, question, asked_at, is_approved)
      VALUES (${generateId()}, ${productId}, ${userId}, ${askerName ?? null}, ${askerEmail ?? null}, ${question.trim()}, NOW(), FALSE)
    `;
    res.status(201).json({ success: true, message: 'Your question has been submitted for review.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

export default router;
