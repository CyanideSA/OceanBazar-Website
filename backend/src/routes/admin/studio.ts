/**
 * Admin Studio — catalog tree, full product editor, brands, coupons, shipments list.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import multer from 'multer';
import { requireAdmin, requireRole } from '../../middleware/auth';
import { routeParam } from '../../utils/params';
import { uploadImage, uploadMedia } from '../../services/cloudinaryService';
import { generateEntityId, generateSlug } from '../../utils/hexId';
import { invalidateCache } from '../../cache/cacheMiddleware';
import sanitizeHtml from 'sanitize-html';
import { appendFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_HTML: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'a', 'h2', 'h3', 'span', 'div', 'blockquote'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'style', 'width', 'height'],
    span: ['style'],
    td: ['style'],
    th: ['style'],
    div: ['style'],
    table: ['style'],
    p: ['style'],
    h2: ['style'],
    h3: ['style'],
  },
  allowedSchemes: ['http', 'https'],
};

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();
const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

router.use(requireAdmin);

/**
 * After any mutating request that touches products, purge the relevant
 * Redis cache prefixes so storefront reads are never stale.
 */
router.use('/products', (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        Promise.all([
          invalidateCache('bff:products'),
          invalidateCache('bff:product-detail'),
          invalidateCache('bff:product-compare'),
          invalidateCache('bff:product-filters'),
        ]).catch(() => { /* non-fatal */ });
      }
    });
  }
  next();
});

// ─── Catalog tree (DB) — category → subcategory → products ───────────────────

router.get('/catalog-tree', async (_req: Request, res: Response) => {
  const tree = await prismaAny.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        orderBy: { sortOrder: 'asc' },
        include: {
          productCategories: {
            include: {
              product: {
                select: {
                  id: true,
                  titleEn: true,
                  titleBn: true,
                  status: true,
                  stock: true,
                  brand: true,
                  isFeatured: true,
                  importSource: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });
  res.json({ tree });
});

// ─── Brands CRUD ─────────────────────────────────────────────────────────────

router.get('/brands', async (req: Request, res: Response) => {
  const search = String(req.query.q || '');
  const where: any = {};
  if (search) where.OR = [
    { nameEn: { contains: search, mode: 'insensitive' } },
    { nameBn: { contains: search, mode: 'insensitive' } },
  ];
  const brands = await prisma.brand.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  res.json({ brands });
});

router.get('/brands/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  const brands = await prisma.brand.findMany({
    where: q ? { OR: [{ nameEn: { contains: q, mode: 'insensitive' } }, { nameBn: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: { nameEn: 'asc' },
    take: 20,
  });
  res.json({ brands });
});

router.get('/brands/:id', async (req: Request, res: Response) => {
  const brand = await prisma.brand.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
  res.json({ brand });
});

router.post('/brands', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { nameEn, nameBn, logoUrl, sortOrder, active } = req.body;
  const brand = await prisma.brand.create({
    data: {
      id: generateEntityId(),
      nameEn,
      nameBn: nameBn || nameEn,
      slug: generateSlug(nameEn),
      logoUrl: logoUrl || null,
      sortOrder: sortOrder ?? 0,
      active: active !== false,
    },
  });
  res.status(201).json({ brand });
});

router.put('/brands/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { nameEn, nameBn, logoUrl, sortOrder, active } = req.body;
  const brand = await prisma.brand.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(nameEn !== undefined && { nameEn }),
      ...(nameBn !== undefined && { nameBn }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(active !== undefined && { active }),
    },
  });
  res.json({ brand });
});

router.delete('/brands/:id', requireRole('super_admin'), async (req: Request, res: Response) => {
  await prisma.brand.update({ where: { id: routeParam(req.params.id) }, data: { active: false } });
  res.json({ message: 'Brand deactivated' });
});

// ─── Product detail (full) ───────────────────────────────────────────────────

router.get('/products/:id', async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { pricing: true, productAssets: { orderBy: { sortOrder: 'asc' } }, productCategories: { include: { category: true } } },
  });
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ product });
});

// ─── Product update (full: pricing + images + flags) ─────────────────────────

router.put('/products/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const b = req.body as {
    titleEn?: string;
    titleBn?: string;
    descriptionEn?: string;
    descriptionBn?: string;
    categoryId?: string;
    brand?: string | null;
    brandLogoUrl?: string | null;
    brandId?: string | null;
    sku?: string | null;
    pricingMode?: 'non_tiered' | 'tiered';
    moq?: number;
    stock?: number;
    tags?: string[];
    status?: 'active' | 'draft' | 'archived' | 'suspended';
    isFeatured?: boolean;
    isBestSeller?: boolean;
    isBestRated?: boolean;
    specifications?: string | null;
    attributesExtra?: string | null;
    retail?: {
      price: number;
      compareAt?: number | null;
      tier1MinQty?: number | null;
      tier1Discount?: number | null;
      tier2MinQty?: number | null;
      tier2Discount?: number | null;
      tier3MinQty?: number | null;
      tier3Discount?: number | null;
      tierBands?: unknown;
    };
    wholesale?: {
      price: number;
      compareAt?: number | null;
      tier1MinQty?: number | null;
      tier1Discount?: number | null;
      tier2MinQty?: number | null;
      tier2Discount?: number | null;
      tier3MinQty?: number | null;
      tier3Discount?: number | null;
      tierBands?: unknown;
    } | null;
    productAssets?: Array<{
      url: string;
      publicId?: string;
      assetType?: 'image' | 'video';
      isPrimary?: boolean;
      sortOrder?: number;
      altEn?: string | null;
      altBn?: string | null;
    }>;
  };

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await (tx as any).product.update({
      where: { id },
      data: {
        ...(b.titleEn !== undefined && { titleEn: b.titleEn }),
        ...(b.titleBn !== undefined && { titleBn: b.titleBn }),
        ...(b.descriptionEn !== undefined && { descriptionEn: b.descriptionEn ? sanitizeHtml(b.descriptionEn, ALLOWED_HTML) : b.descriptionEn }),
        ...(b.descriptionBn !== undefined && { descriptionBn: b.descriptionBn ? sanitizeHtml(b.descriptionBn, ALLOWED_HTML) : b.descriptionBn }),
        ...(b.brand !== undefined && { brand: b.brand }),
        ...(b.brandId !== undefined && { brandId: b.brandId }),
        ...(b.brandLogoUrl !== undefined && { brandLogoUrl: b.brandLogoUrl }),
        ...(b.sku !== undefined && { sku: b.sku }),
        ...(b.pricingMode !== undefined && { pricingMode: b.pricingMode }),
        ...(b.moq !== undefined && { moq: b.moq }),
        ...(b.stock !== undefined && { stock: b.stock }),
        ...(b.status !== undefined && { status: b.status }),
        ...(b.isFeatured !== undefined && { isFeatured: b.isFeatured }),
        ...(b.isBestSeller !== undefined && { isBestSeller: b.isBestSeller }),
        ...(b.isBestRated !== undefined && { isBestRated: b.isBestRated }),
        ...(b.specifications !== undefined && { specifications: b.specifications }),
        ...(b.attributesExtra !== undefined && { attributesExtra: b.attributesExtra }),
      },
    });

    // Update product_category_map if categoryId provided
    if (b.categoryId) {
      const cat = await tx.category.findUnique({ where: { id: b.categoryId } });
      if (cat) {
        await (tx as any).productCategoryMap.deleteMany({ where: { productId: id } });
        await (tx as any).productCategoryMap.create({
          data: { productId: id, categoryId: b.categoryId, isPrimary: true, sortOrder: 0 },
        });
      }
    }

    if (b.productAssets) {
      // #region agent log
      try {
        appendFileSync(
          join(process.cwd(), 'debug-f9670f.log'),
          `${JSON.stringify({ sessionId: 'f9670f', location: 'studio.ts:productAssets', message: 'product asset batch update', data: { productId: id, count: b.productAssets.length }, timestamp: Date.now(), hypothesisId: 'H2' })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      await tx.productAsset.deleteMany({ where: { productId: id } });
      if (b.productAssets.length) {
        await tx.productAsset.createMany({
          data: b.productAssets.map((img, i) => ({
            productId: id,
            url: img.url,
            assetType: img.assetType ?? 'image',
            isPrimary: img.isPrimary ?? i === 0,
            sortOrder: img.sortOrder ?? i,
            altEn: img.altEn ?? null,
            altBn: img.altBn ?? null,
          })),
        });
      }
    }

    if (b.retail || b.wholesale !== undefined) {
      await tx.productPricing.deleteMany({ where: { productId: id } });
      const rows: {
        productId: string;
        customerType: 'retail' | 'wholesale';
        price: number;
        compareAt: number | null;
        tier1MinQty: number | null;
        tier1Discount: number | null;
        tier2MinQty: number | null;
        tier2Discount: number | null;
        tier3MinQty: number | null;
        tier3Discount: number | null;
        tierBands?: Prisma.InputJsonValue;
      }[] = [];

      function normalizedBands(br: { tierBands?: unknown }): Prisma.InputJsonValue | undefined {
        const raw = br.tierBands;
        if (!raw || !Array.isArray(raw) || raw.length < 1) return undefined;
        return raw as unknown as Prisma.InputJsonValue;
      }

      if (b.retail) {
        rows.push({
          productId: id,
          customerType: 'retail',
          price: b.retail.price,
          compareAt: b.retail.compareAt ?? null,
          tier1MinQty: b.retail.tier1MinQty !== undefined ? b.retail.tier1MinQty : null,
          tier1Discount: b.retail.tier1Discount !== undefined ? b.retail.tier1Discount : null,
          tier2MinQty: b.retail.tier2MinQty !== undefined ? b.retail.tier2MinQty : null,
          tier2Discount: b.retail.tier2Discount !== undefined ? b.retail.tier2Discount : null,
          tier3MinQty: b.retail.tier3MinQty !== undefined ? b.retail.tier3MinQty : null,
          tier3Discount: b.retail.tier3Discount !== undefined ? b.retail.tier3Discount : null,
          tierBands: normalizedBands(b.retail),
        });
      }
      if (b.wholesale) {
        rows.push({
          productId: id,
          customerType: 'wholesale',
          price: b.wholesale.price,
          compareAt: b.wholesale.compareAt ?? null,
          tier1MinQty: b.wholesale.tier1MinQty !== undefined ? b.wholesale.tier1MinQty : null,
          tier1Discount: b.wholesale.tier1Discount !== undefined ? b.wholesale.tier1Discount : null,
          tier2MinQty: b.wholesale.tier2MinQty !== undefined ? b.wholesale.tier2MinQty : null,
          tier2Discount: b.wholesale.tier2Discount !== undefined ? b.wholesale.tier2Discount : null,
          tier3MinQty: b.wholesale.tier3MinQty !== undefined ? b.wholesale.tier3MinQty : null,
          tier3Discount: b.wholesale.tier3Discount !== undefined ? b.wholesale.tier3Discount : null,
          tierBands: normalizedBands(b.wholesale),
        });
      }
      if (rows.length) await tx.productPricing.createMany({ data: rows });
    }
  });

  const product = await prisma.product.findUnique({
    where: { id },
    include: { pricing: true, productAssets: { orderBy: { sortOrder: 'asc' } }, productCategories: { include: { category: true } } },
  });
  res.json({ product });
});

// ─── Move product (drag-drop category change) ────────────────────────────────

async function assignProductCategory(productId: string, categoryId: string): Promise<void> {
  await prismaAny.productCategoryMap.deleteMany({ where: { productId } });
  await prismaAny.productCategoryMap.create({
    data: { productId, categoryId, isPrimary: true, sortOrder: 0 },
  });
}

router.patch('/products/:id/category', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { categoryId } = req.body as { categoryId: string };
  const productId = routeParam(req.params.id);
  if (!categoryId) { res.status(400).json({ error: 'categoryId required' }); return; }
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
  await assignProductCategory(productId, categoryId);
  const product = await prismaAny.product.findUnique({
    where: { id: productId },
    include: { productCategories: { include: { category: true } } },
  });
  res.json({ product });
});

router.patch('/products/:id/move', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { categoryId } = req.body as { categoryId: string };
  const productId = routeParam(req.params.id);
  if (!categoryId) { res.status(400).json({ error: 'categoryId required' }); return; }
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
  await assignProductCategory(productId, categoryId);
  const product = await prismaAny.product.findUnique({
    where: { id: productId },
    include: { productCategories: { include: { category: true } } },
  });
  res.json({ product });
});

// ─── Categories update / delete ──────────────────────────────────────────────

router.put('/categories/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { nameEn, nameBn, parentId, icon, imageUrl, sortOrder } = req.body as {
    nameEn?: string;
    nameBn?: string;
    parentId?: string | null;
    icon?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
  };
  const id = routeParam(req.params.id);
  if (parentId === id) {
    res.status(400).json({ error: 'Category cannot be its own parent' });
    return;
  }
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(nameEn !== undefined && { nameEn }),
      ...(nameBn !== undefined && { nameBn }),
      ...(parentId !== undefined && { parentId }),
      ...(icon !== undefined && { icon }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  void invalidateCache('bff:categories');
  res.json({ category });
});

router.delete('/categories/:id', requireRole('super_admin'), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const [childCount, prodCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prismaAny.product.count({ where: { productCategories: { some: { categoryId: id } } } }),
  ]);
  if (childCount > 0 || prodCount > 0) {
    res.status(400).json({ error: 'Remove subcategories and products first' });
    return;
  }
  await prisma.category.delete({ where: { id } });
  void invalidateCache('bff:categories');
  res.json({ ok: true });
});

// ─── Coupons ─────────────────────────────────────────────────────────────────

router.get('/coupons', async (_req: Request, res: Response) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { id: 'desc' } });
  res.json({ coupons });
});

router.post('/coupons', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { code, type, value, minOrder, maxUses, startsAt, expiresAt, active } = req.body as {
    code: string;
    type: 'percent' | 'fixed' | 'free_shipping';
    value: number;
    minOrder?: number;
    maxUses?: number | null;
    startsAt: string;
    expiresAt?: string | null;
    active?: boolean;
  };
  if (!code || !type || value == null) {
    res.status(400).json({ error: 'code, type, value required' });
    return;
  }
  const coupon = await prisma.coupon.create({
    data: {
      code: code.trim().toUpperCase(),
      type,
      value,
      minOrder: minOrder ?? 0,
      maxUses: maxUses ?? null,
      startsAt: new Date(startsAt),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: active ?? true,
    },
  });
  res.status(201).json({ coupon });
});

router.put('/coupons/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const data = req.body as Record<string, unknown>;
  const coupon = await prisma.coupon.update({
    where: { id: parseInt(routeParam(req.params.id), 10) },
    data: {
      ...(data.code !== undefined && { code: String(data.code).trim().toUpperCase() }),
      ...(data.type !== undefined && { type: data.type as 'percent' | 'fixed' | 'free_shipping' }),
      ...(data.value !== undefined && { value: Number(data.value) }),
      ...(data.minOrder !== undefined && { minOrder: Number(data.minOrder) }),
      ...(data.maxUses !== undefined && { maxUses: data.maxUses === null ? null : Number(data.maxUses) }),
      ...(data.startsAt !== undefined && { startsAt: new Date(String(data.startsAt)) }),
      ...(data.expiresAt !== undefined && {
        expiresAt: data.expiresAt ? new Date(String(data.expiresAt)) : null,
      }),
      ...(data.active !== undefined && { active: Boolean(data.active) }),
    },
  });
  res.json({ coupon });
});

// ─── Shipments (list + status) ───────────────────────────────────────────────

router.get('/shipments', async (_req: Request, res: Response) => {
  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });
  res.json({ shipments });
});

router.put('/shipments/:id', async (req: Request, res: Response) => {
  const { status, estimatedDelivery } = req.body as {
    status?: string;
    estimatedDelivery?: string | null;
  };
  const shipment = await prisma.shipment.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status: status as 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' }),
      ...(estimatedDelivery !== undefined && {
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      }),
    },
  });
  res.json({ shipment });
});

// ─── Product detail alias ────────────────────────────────────────────────────

router.get('/products/:id/detail', async (req: Request, res: Response) => {
  const product = await prismaAny.product.findUnique({
    where: { id: routeParam(req.params.id) },
    include: {
      pricing: true,
      productAssets: { orderBy: { sortOrder: 'asc' } },
      productCategories: { include: { category: true } },
      productTags: { include: { tags: true } },
      variants: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  res.json({ product });
});

// ─── Product Assets ──────────────────────────────────────────────────────────

router.get('/products/:id/assets', async (req: Request, res: Response) => {
  const assets = await prisma.productAsset.findMany({
    where: { productId: routeParam(req.params.id) },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ assets });
});

router.post('/products/:id/assets/upload', requireRole('super_admin', 'admin'), memUpload.single('file'), async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const mime = req.file.mimetype || '';
  const rt: 'image' | 'video' | 'auto' = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : 'auto';
  const uploaded = await uploadMedia(req.file.buffer, 'products', { resourceType: rt });
  const count = await prisma.productAsset.count({ where: { productId } });
  const assetType = (req.body.assetType as string) || (mime.startsWith('video/') ? 'video' : 'image');
  const asset = await prisma.productAsset.create({
    data: {
      productId,
      url: uploaded.secureUrl || uploaded.url,
      assetType,
      isPrimary: req.body.isPrimary === 'true' || count === 0,
      sortOrder: count,
      mimeType: mime || null,
      fileSize: req.file.size ? BigInt(req.file.size) : null,
    },
  });
  res.status(201).json({ asset });
});

router.put('/products/:id/assets/:assetId', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { url, assetType, isPrimary, sortOrder, altEn, altBn } = req.body;
  const asset = await prismaAny.productAsset.update({
    where: { id: routeParam(req.params.assetId) },
    data: {
      ...(url !== undefined && { url }),
      ...(assetType !== undefined && { assetType }),
      ...(isPrimary !== undefined && { isPrimary }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(altEn !== undefined && { altEn }),
      ...(altBn !== undefined && { altBn }),
    },
  });
  res.json({ asset });
});

router.delete('/products/:id/assets/:assetId', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  await prismaAny.productAsset.delete({ where: { id: routeParam(req.params.assetId) } });
  res.json({ ok: true });
});

router.patch('/products/:id/assets/reorder', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const items = req.body as Array<{ id: string; sortOrder: number }>;
  await Promise.all(items.map((item) => prismaAny.productAsset.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })));
  res.json({ ok: true });
});

// ─── Product Pricing ─────────────────────────────────────────────────────────

router.get('/products/:id/pricing', async (req: Request, res: Response) => {
  const pricing = await prisma.productPricing.findMany({ where: { productId: routeParam(req.params.id) } });
  res.json({ pricing });
});

router.post('/products/:id/pricing', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  const row = req.body as Record<string, unknown>;
  const existing = await prisma.productPricing.findFirst({ where: { productId, customerType: row.customerType as 'retail' | 'wholesale' } });
  let pricing;
  if (existing) {
    pricing = await prisma.productPricing.update({ where: { id: existing.id }, data: { ...row as any, productId } });
  } else {
    pricing = await prismaAny.productPricing.create({ data: { id: generateEntityId(), productId, ...row } });
  }
  res.json({ pricing });
});

router.put('/products/:id/pricing/replace', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  const rows = req.body as Array<Record<string, unknown>>;
  await prisma.productPricing.deleteMany({ where: { productId } });
  const created = await Promise.all(rows.map((r) => prismaAny.productPricing.create({ data: { id: generateEntityId(), productId, ...r } })));
  res.json({ pricing: created });
});

router.put('/products/:id/pricing/:rowId', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const pricing = await prisma.productPricing.update({ where: { id: parseInt(routeParam(req.params.rowId)) }, data: req.body });
  res.json({ pricing });
});

router.delete('/products/:id/pricing/:rowId', requireRole('super_admin'), async (req: Request, res: Response) => {
  await prisma.productPricing.delete({ where: { id: parseInt(routeParam(req.params.rowId)) } });
  res.json({ ok: true });
});

// ─── Product Tags ────────────────────────────────────────────────────────────

router.get('/products/:id/tags', async (req: Request, res: Response) => {
  const productTags = await prismaAny.productTag.findMany({
    where: { productId: routeParam(req.params.id) },
    include: { tags: true },
  });
  res.json({ tags: productTags });
});

router.put('/products/:id/tags', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  const { tagIds } = req.body as { tagIds: number[] };
  await prismaAny.productTag.deleteMany({ where: { productId } });
  if (tagIds?.length) {
    await prismaAny.productTag.createMany({ data: tagIds.map((tagId) => ({ productId, tagId })), skipDuplicates: true });
  }
  res.json({ ok: true });
});

// ─── Product Variants ────────────────────────────────────────────────────────

router.get('/products/:id/variants', async (req: Request, res: Response) => {
  const variants = await prismaAny.productVariantsLegacy.findMany({ where: { product_id: routeParam(req.params.id) } });
  res.json({ variants });
});

router.post('/products/:id/variants', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const variant = await prismaAny.productVariantsLegacy.create({
    data: { id: generateEntityId(), product_id: routeParam(req.params.id), ...req.body },
  });
  res.status(201).json({ variant });
});

router.put('/products/:id/variants/:variantId', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const variant = await prismaAny.productVariantsLegacy.update({
    where: { id: routeParam(req.params.variantId) },
    data: req.body,
  });
  res.json({ variant });
});

router.delete('/products/:id/variants/:variantId', requireRole('super_admin'), async (req: Request, res: Response) => {
  await prismaAny.productVariantsLegacy.delete({ where: { id: routeParam(req.params.variantId) } });
  res.json({ ok: true });
});

// ─── Product Category Map ────────────────────────────────────────────────────

router.get('/products/:id/categories', async (req: Request, res: Response) => {
  const maps = await prismaAny.productCategoryMap.findMany({
    where: { productId: routeParam(req.params.id) },
    include: { category: true },
  });
  res.json({ categories: maps });
});

router.put('/products/:id/categories', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  const { categoryIds } = req.body as { categoryIds: string[] };
  await prismaAny.productCategoryMap.deleteMany({ where: { productId } });
  if (categoryIds?.length) {
    await prismaAny.productCategoryMap.createMany({
      data: categoryIds.map((cid, i) => ({ productId, categoryId: cid, isPrimary: i === 0, sortOrder: i })),
      skipDuplicates: true,
    });
  }
  res.json({ ok: true });
});

// ─── Product Metrics + Click tracking ───────────────────────────────────────

router.get('/products/:id/metrics', async (req: Request, res: Response) => {
  const metrics = await prismaAny.productMetrics.findUnique({ where: { productId: routeParam(req.params.id) } });
  res.json({ metrics: metrics || { productId: req.params.id, views: 0, totalOrders: 0, totalQuantitySold: 0, totalRevenue: 0 } });
});

router.post('/products/:id/track-click', async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  await prismaAny.productMetrics.upsert({
    where: { productId },
    update: { views: { increment: 1 } },
    create: { productId, views: 1 },
  });
  res.json({ ok: true });
});

// ─── Product Bulk Upload (CSV) ───────────────────────────────────────────────

router.post('/products/bulk-upload', requireRole('super_admin', 'admin'), memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  res.status(200).json({ message: 'Bulk upload received. Processing not yet implemented.', filename: req.file.originalname });
});

// ─── Catalog Search ──────────────────────────────────────────────────────────

router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  if (!q) { res.json({ products: [], categories: [] }); return; }
  const [products, categories] = await Promise.all([
    prismaAny.product.findMany({
      where: { OR: [{ titleEn: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, titleEn: true, sku: true, status: true },
      take: 20,
    }),
    prisma.category.findMany({
      where: { nameEn: { contains: q, mode: 'insensitive' } },
      select: { id: true, nameEn: true, nameBn: true },
      take: 10,
    }),
  ]);
  res.json({ products, categories });
});

// ─── Homepage Categories ─────────────────────────────────────────────────────

router.get('/homepage/categories', async (_req: Request, res: Response) => {
  const setting = await prismaAny.site_settings.findFirst({ where: { key: 'homepage_categories' } });
  res.json({ categoryIds: setting?.value ? JSON.parse(setting.value) : [] });
});

router.post('/homepage/categories', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { categoryIds } = req.body as { categoryIds: string[] };
  await prismaAny.site_settings.upsert({
    where: { key: 'homepage_categories' },
    update: { value: JSON.stringify(categoryIds) },
    create: { key: 'homepage_categories', value: JSON.stringify(categoryIds) },
  });
  res.json({ ok: true });
});

// ─── Banners ─────────────────────────────────────────────────────────────────

router.get('/banners', async (req: Request, res: Response) => {
  const productId = req.query.productId as string | undefined;
  const where = productId ? { productId } : {};
  const banners = await prisma.productBanner.findMany({ where, orderBy: { sortOrder: 'asc' } }).catch(() => []);
  res.json({ banners });
});

router.post('/banners', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { productId, categoryId, imageUrl, linkUrl, title, placement, sortOrder, enabled } = req.body;
  const banner = await prisma.productBanner.create({
    data: {
      productId: productId ?? null,
      categoryId: categoryId ?? null,
      imageUrl,
      linkUrl: linkUrl ?? null,
      title: title ?? null,
      placement: placement ?? 'ALL',
      sortOrder: sortOrder ?? 0,
      enabled: enabled ?? true,
    },
  });
  res.status(201).json({ banner });
});

router.put('/banners/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { imageUrl, linkUrl, title, placement, sortOrder, enabled } = req.body;
  const banner = await prisma.productBanner.update({
    where: { id: parseInt(routeParam(req.params.id)) },
    data: {
      ...(imageUrl !== undefined && { imageUrl }),
      ...(linkUrl !== undefined && { linkUrl }),
      ...(title !== undefined && { title }),
      ...(placement !== undefined && { placement }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(enabled !== undefined && { enabled }),
    },
  });
  res.json({ banner });
});

router.delete('/banners/:id', requireRole('super_admin'), async (req: Request, res: Response) => {
  await prisma.productBanner.delete({ where: { id: parseInt(routeParam(req.params.id)) } });
  res.json({ ok: true });
});

// ─── Tag Groups + Tags ───────────────────────────────────────────────────────

router.get('/tag-groups', async (_req: Request, res: Response) => {
  try {
    const groups = await prismaAny.tagGroup.findMany({ include: { tags: true }, orderBy: { id: 'asc' } });
    res.json({ groups });
  } catch {
    res.json({ groups: [] }); // schema may not have tagGroup yet
  }
});

router.post('/tag-groups', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const group = await prismaAny.tagGroup.create({ data: req.body });
    res.status(201).json({ group });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/tag-groups/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const group = await prismaAny.tagGroup.update({ where: { id: parseInt(routeParam(req.params.id)) }, data: req.body });
    res.json({ group });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tag-groups/:id', requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    await prismaAny.tagGroup.delete({ where: { id: parseInt(routeParam(req.params.id)) } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tags', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const tag = await prismaAny.tag.create({ data: req.body });
    res.status(201).json({ tag });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/tags/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const tag = await prismaAny.tag.update({ where: { id: parseInt(routeParam(req.params.id)) }, data: req.body });
    res.json({ tag });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tags/:id', requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    await prismaAny.tag.delete({ where: { id: parseInt(routeParam(req.params.id)) } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


export default router;
