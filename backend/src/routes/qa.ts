import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
