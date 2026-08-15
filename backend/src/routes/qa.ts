import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { emitAdminEvent, emitBroadcast } from '../lib/adminEvents';
import { optionalAuth } from '../middleware/auth';

const router = Router();

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function ensureProductQaTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_qa (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT,
      asker_name TEXT,
      asker_email TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      image_urls TEXT[] DEFAULT '{}',
      asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at TIMESTAMPTZ,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS answer_image_urls TEXT[] DEFAULT '{}'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS answered_by_name TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_product_qa_product ON product_qa(product_id)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_product_qa_pending ON product_qa(is_approved, asked_at DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_product_qa_status ON product_qa(status, asked_at DESC)
  `);
}

let tableReady: Promise<void> | null = null;
export function readyQaTable() {
  if (!tableReady) {
    tableReady = ensureProductQaTable().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

function mapQaRow(q: any) {
  return {
    id: q.id,
    question: q.question,
    answer: q.answer,
    askerName: q.asker_name,
    asker_name: q.asker_name,
    askerAvatar: q.asker_avatar || null,
    askedAt: q.asked_at,
    asked_at: q.asked_at,
    answeredAt: q.answered_at,
    answered_at: q.answered_at,
    answeredByName: q.answered_by_name || (q.answer ? 'OceanBazar Customer Support' : null),
    imageUrls: q.image_urls ?? [],
    answerImageUrls: q.answer_image_urls ?? [],
    status: q.status || (q.is_approved ? 'approved' : 'pending'),
    pending: !(q.is_approved || q.status === 'approved'),
  };
}

// GET /api/qa/:productId — approved Q&As (+ caller's own pending when authed)
router.get('/:productId', optionalAuth, async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  try {
    await readyQaTable();
    const items = await prisma.$queryRaw<any[]>`
      SELECT q.id, q.question, q.answer, q.asked_at, q.answered_at, q.image_urls, q.answer_image_urls,
             q.answered_by_name, q.is_approved, q.status, q.user_id,
             COALESCE(q.asker_name, u.name) as asker_name,
             u.profile_image as asker_avatar
      FROM product_qa q
      LEFT JOIN users u ON u.id = q.user_id
      WHERE q.product_id = ${productId}
        AND (q.is_approved = TRUE OR q.status = 'approved')
      ORDER BY q.asked_at DESC
      LIMIT 50
    `;
    let mine: any[] = [];
    if (req.user?.userId) {
      mine = await prisma.$queryRaw<any[]>`
        SELECT q.id, q.question, q.answer, q.asked_at, q.answered_at, q.image_urls, q.answer_image_urls,
               q.answered_by_name, q.is_approved, q.status, q.user_id,
               COALESCE(q.asker_name, u.name) as asker_name,
               u.profile_image as asker_avatar
        FROM product_qa q
        LEFT JOIN users u ON u.id = q.user_id
        WHERE q.product_id = ${productId}
          AND q.user_id = ${req.user.userId}
          AND (q.is_approved = FALSE AND COALESCE(q.status, 'pending') = 'pending')
        ORDER BY q.asked_at DESC
        LIMIT 10
      `;
    }
    const seen = new Set(items.map((x) => x.id));
    const merged = [...mine.filter((m) => !seen.has(m.id)), ...items];
    res.json({ qa: merged.map(mapQaRow) });
  } catch (err: any) {
    console.error('[qa] list failed:', err?.message);
    res.json({ qa: [] });
  }
});

// POST /api/qa/:productId — submit a question (public; auth optional)
router.post('/:productId', optionalAuth, async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  const { question, askerName, askerEmail, imageUrls } = req.body as {
    question: string;
    askerName?: string;
    askerEmail?: string;
    imageUrls?: string[];
  };
  if (!question || question.trim().length < 5) {
    res.status(400).json({ error: 'Question must be at least 5 characters' });
    return;
  }

  const safeImageUrls = (Array.isArray(imageUrls) ? imageUrls : [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u))
    .slice(0, 5);

  try {
    await readyQaTable();
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, titleEn: true, titleBn: true, sku: true },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const userId = req.user?.userId ?? null;
    let resolvedName = askerName?.trim() || null;
    let resolvedEmail = askerEmail?.trim() || null;
    let profileImage: string | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, profileImage: true },
      });
      resolvedName = resolvedName || user?.name || null;
      resolvedEmail = resolvedEmail || user?.email || null;
      profileImage = user?.profileImage ?? null;
    }

    const id = generateId();
    const q = question.trim();
    await prisma.$executeRawUnsafe(
      `INSERT INTO product_qa (id, product_id, user_id, asker_name, asker_email, question, image_urls, asked_at, is_approved, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], NOW(), FALSE, 'pending')`,
      id,
      productId,
      userId,
      resolvedName,
      resolvedEmail,
      q,
      safeImageUrls,
    );

    const mainImage =
      (await prisma.productAsset.findFirst({
        where: { productId, assetType: 'image' },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { url: true },
      }))?.url ?? null;

    const snapshot = {
      id,
      productId,
      productTitle: product.titleEn,
      productTitleBn: product.titleBn,
      productSku: product.sku ?? null,
      productImage: mainImage,
      question: q,
      askerName: resolvedName,
      askerEmail: resolvedEmail,
      askerAvatar: profileImage,
      userId,
      imageUrls: safeImageUrls,
      status: 'pending',
      askedAt: new Date().toISOString(),
    };
    try { emitAdminEvent('admin:qa:new', snapshot); } catch { /* non-fatal */ }
    try { emitBroadcast('storefront:qa:updated', { productId }); } catch { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: 'Your question has been submitted. It will appear after OceanBazar replies.',
      id,
      item: mapQaRow({
        id,
        question: q,
        answer: null,
        asked_at: new Date(),
        answered_at: null,
        image_urls: safeImageUrls,
        answer_image_urls: [],
        answered_by_name: null,
        is_approved: false,
        status: 'pending',
        asker_name: resolvedName,
        asker_avatar: profileImage,
      }),
    });
  } catch (err: any) {
    console.error('[qa] submit failed:', err?.message);
    res.status(500).json({ error: 'Failed to submit question', detail: err?.message });
  }
});

export default router;
