import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import {
  buildMicrosoftAuthorizeUrl,
  consumeContentIdHandoffCode,
  createContentIdHandoffCode,
  exchangeMicrosoftCode,
} from '../services/microsoftSsoService';
import { requireContentIdUser, signContentIdToken } from '../middleware/contentIdAuth';
import { contentIdCatalogLimiter, contentIdGenerateLimiter } from '../middleware/rateLimiter';
import {
  ensureBrand,
  ensureRootCategory,
  ensureSubcategory,
  fetchCatalogTree,
  resolveCatalogSelection,
} from '../services/contentIdCatalogService';
import { generateEntityId, formatOrderNumber } from '../utils/hexId';

const router = Router();
const prisma = new PrismaClient();

function contentIdAppUrl(): string {
  return (process.env.CONTENT_ID_APP_URL || 'http://localhost:5180').replace(/\/$/, '');
}

function contentIdRedirectUri(): string {
  return (
    process.env.MS_CONTENT_ID_REDIRECT_URI ||
    'http://localhost:4000/api/content-id/auth/sso/microsoft/callback'
  );
}

async function generateUniqueProductId(maxAttempts = 12): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = generateEntityId();
    const existingDraft = await prisma.contentDraft.findUnique({
      where: { id: candidate },
      select: { id: true },
    });
    if (existingDraft) continue;

    try {
      const existingProduct = await prisma.product.findUnique({
        where: { id: candidate },
        select: { id: true },
      });
      if (existingProduct) continue;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[content-id] products lookup skipped during ID generation:', message);
    }

    return candidate;
  }
  return null;
}

async function sendCatalog(res: Response) {
  try {
    const catalog = await fetchCatalogTree();
    res.json(catalog);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[content-id] catalog load failed:', message);
    res.status(500).json({ error: 'catalog_load_failed' });
  }
}

router.get('/auth/sso/status', (_req: Request, res: Response) => {
  const configured = Boolean(
    process.env.MS_SSO_CLIENT_ID &&
    process.env.MS_SSO_CLIENT_SECRET &&
    process.env.MS_TENANT_ID &&
    contentIdRedirectUri(),
  );
  res.json({ microsoft: configured });
});

router.get('/auth/sso/microsoft/start', async (_req: Request, res: Response) => {
  const result = await buildMicrosoftAuthorizeUrl(contentIdRedirectUri());
  if ('error' in result) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.redirect(result.url);
});

router.get('/auth/sso/microsoft/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const base = contentIdAppUrl();
  if (!code || !state) {
    res.redirect(`${base}/?sso_error=missing_params`);
    return;
  }

  const exchanged = await exchangeMicrosoftCode(code, state, contentIdRedirectUri());
  if ('error' in exchanged) {
    res.redirect(`${base}/?sso_error=${encodeURIComponent(exchanged.error)}`);
    return;
  }

  const email = String(
    exchanged.claims.email || exchanged.claims.preferred_username || exchanged.claims.upn || '',
  ).toLowerCase();
  if (!email) {
    res.redirect(`${base}/?sso_error=missing_email`);
    return;
  }

  const handoff = await createContentIdHandoffCode({
    email,
    oid: exchanged.claims.oid,
    name: exchanged.claims.name,
  });
  if (!handoff) {
    res.redirect(`${base}/?sso_error=handoff_failed`);
    return;
  }

  res.redirect(`${base}/?sso_code=${handoff}`);
});

router.post('/auth/sso/exchange', async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: 'code required' });
    return;
  }

  const payload = await consumeContentIdHandoffCode(code);
  if (!payload) {
    res.status(401).json({ error: 'invalid_or_expired_handoff' });
    return;
  }

  const token = signContentIdToken({
    email: payload.email,
    oid: payload.oid,
    name: payload.name,
  });

  res.json({
    token,
    user: {
      email: payload.email,
      name: payload.name ?? null,
    },
  });
});

router.get('/auth/me', requireContentIdUser, (req: Request, res: Response) => {
  res.json({
    user: {
      email: req.contentIdUser!.email,
      name: req.contentIdUser!.name ?? null,
    },
  });
});

router.get('/catalog', requireContentIdUser, async (_req: Request, res: Response) => {
  await sendCatalog(res);
});

router.get('/suggest', requireContentIdUser, async (_req: Request, res: Response) => {
  await sendCatalog(res);
});

router.post(
  '/catalog/categories',
  requireContentIdUser,
  contentIdCatalogLimiter,
  [body('nameEn').trim().notEmpty().withMessage('Category name is required')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { nameEn, nameBn } = req.body as { nameEn: string; nameBn?: string };
    try {
      const result = await ensureRootCategory({ nameEn, nameBn });
      res.status(result.created ? 201 : 200).json({
        category: {
          id: result.item.id,
          nameEn: result.item.nameEn,
          nameBn: result.item.nameBn,
        },
        created: result.created,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[content-id] create category failed:', message);
      res.status(500).json({ error: 'create_failed' });
    }
  },
);

router.post(
  '/catalog/subcategories',
  requireContentIdUser,
  contentIdCatalogLimiter,
  [
    body('parentId').trim().notEmpty().withMessage('Parent category is required'),
    body('nameEn').trim().notEmpty().withMessage('Subcategory name is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { parentId, nameEn, nameBn } = req.body as {
      parentId: string;
      nameEn: string;
      nameBn?: string;
    };
    try {
      const result = await ensureSubcategory({ parentId, nameEn, nameBn });
      res.status(result.created ? 201 : 200).json({
        subcategory: {
          id: result.item.id,
          nameEn: result.item.nameEn,
          nameBn: result.item.nameBn,
          parentId: result.item.parentId,
        },
        created: result.created,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'create_failed';
      if (msg === 'parent_not_found') {
        res.status(404).json({ error: 'parent_not_found' });
        return;
      }
      if (msg === 'parent_must_be_root') {
        res.status(400).json({ error: 'parent_must_be_root' });
        return;
      }
      res.status(500).json({ error: 'create_failed' });
    }
  },
);

router.post(
  '/catalog/brands',
  requireContentIdUser,
  contentIdCatalogLimiter,
  [body('nameEn').trim().notEmpty().withMessage('Brand name is required')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { nameEn, nameBn } = req.body as { nameEn: string; nameBn?: string };
    try {
      const result = await ensureBrand({ nameEn, nameBn });
      res.status(result.created ? 201 : 200).json({
        brand: {
          id: result.item.id,
          nameEn: result.item.nameEn,
          nameBn: result.item.nameBn,
        },
        created: result.created,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[content-id] create brand failed:', message);
      res.status(500).json({ error: 'create_failed' });
    }
  },
);

router.post(
  '/generate',
  requireContentIdUser,
  contentIdGenerateLimiter,
  [
    body('productName').trim().notEmpty().withMessage('Product name is required'),
    body('categoryId').optional().isString().isLength({ min: 8, max: 8 }),
    body('subcategoryId').optional().isString().isLength({ min: 8, max: 8 }),
    body('brandId').optional().isString().isLength({ min: 8, max: 8 }),
    body('brandName').optional().trim().isString(),
    body('categoryName').optional().trim().isString(),
    body('subcategoryName').optional().trim().isString(),
    body('socialRef').optional({ nullable: true }).isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const data = req.body as {
      productName: string;
      categoryId?: string;
      subcategoryId?: string;
      brandId?: string;
      brandName?: string;
      categoryName?: string;
      subcategoryName?: string;
      socialRef?: string;
    };

    try {
      const selection = await resolveCatalogSelection({
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        brandId: data.brandId,
        categoryName: data.categoryName,
        subcategoryName: data.subcategoryName,
        brandName: data.brandName,
      });

      if ('error' in selection) {
        res.status(400).json({ error: selection.error });
        return;
      }

      const id = await generateUniqueProductId();
      if (!id) {
        res.status(503).json({ error: 'id_generation_failed' });
        return;
      }

      const user = req.contentIdUser!;
      const draft = await prisma.contentDraft.create({
        data: {
          id,
          productName: data.productName.trim(),
          brandName: selection.brandName,
          categoryName: selection.categoryName,
          subcategoryName: selection.subcategoryName,
          categoryId: selection.categoryId,
          subcategoryId: selection.subcategoryId,
          brandId: selection.brandId,
          createdByEmail: user.email,
          createdByOid: user.oid,
          createdByName: user.name,
          socialRef: data.socialRef?.trim() || null,
          status: 'reserved',
        },
      });

      res.status(201).json({
        id: draft.id,
        displayId: formatOrderNumber(draft.id),
        productName: draft.productName,
        brandName: draft.brandName,
        categoryName: draft.categoryName,
        subcategoryName: draft.subcategoryName,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        brandId: draft.brandId,
        socialRef: draft.socialRef,
        createdAt: draft.createdAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[content-id] generate failed:', message);
      res.status(500).json({ error: 'generate_failed' });
    }
  },
);

router.get('/mine', requireContentIdUser, async (req: Request, res: Response) => {
  const email = req.contentIdUser!.email;
  const drafts = await prisma.contentDraft.findMany({
    where: { createdByEmail: email },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    drafts: drafts.map((d) => ({
      id: d.id,
      displayId: formatOrderNumber(d.id),
      productName: d.productName,
      brandName: d.brandName,
      categoryName: d.categoryName,
      subcategoryName: d.subcategoryName,
      socialRef: d.socialRef,
      status: d.status,
      createdAt: d.createdAt,
    })),
  });
});

export default router;
