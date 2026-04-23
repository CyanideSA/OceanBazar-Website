/**
 * Admin Studio — catalog tree, full product editor, brands, coupons, shipments list.
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin, requireRole } from '../../middleware/auth';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

// ─── Catalog tree (DB) — category → subcategory → products ───────────────────

router.get('/catalog-tree', async (_req: Request, res: Response) => {
  const tree = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        orderBy: { sortOrder: 'asc' },
        include: {
          products: {
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
            orderBy: { updatedAt: 'desc' },
          },
        },
      },
    },
  });
  res.json({ tree });
});

// ─── Distinct brands (for product form) ──────────────────────────────────────

router.get('/brands', async (_req: Request, res: Response) => {
  const rows = await prisma.product.findMany({
    where: { AND: [{ brand: { not: null } }, { brand: { not: '' } }] },
    select: { brand: true },
  });
  const brands = [...new Set(rows.map((r) => r.brand).filter(Boolean))] as string[];
  brands.sort((a, b) => a.localeCompare(b));
  res.json({ brands });
});

// ─── Product detail (full) ───────────────────────────────────────────────────

router.get('/products/:id', async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { pricing: true, productAssets: { orderBy: { sortOrder: 'asc' } }, category: true },
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
    sku?: string | null;
    moq?: number;
    stock?: number;
    tags?: string[];
    status?: 'active' | 'draft' | 'archived';
    isFeatured?: boolean;
    retail?: {
      price: number;
      compareAt?: number | null;
      tier1MinQty?: number | null;
      tier1Discount?: number | null;
      tier2MinQty?: number | null;
      tier2Discount?: number | null;
      tier3MinQty?: number | null;
      tier3Discount?: number | null;
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
    } | null;
    productAssets?: Array<{
      url: string;
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
    await tx.product.update({
      where: { id },
      data: {
        ...(b.titleEn !== undefined && { titleEn: b.titleEn }),
        ...(b.titleBn !== undefined && { titleBn: b.titleBn }),
        ...(b.descriptionEn !== undefined && { descriptionEn: b.descriptionEn }),
        ...(b.descriptionBn !== undefined && { descriptionBn: b.descriptionBn }),
        ...(b.categoryId !== undefined && { categoryId: b.categoryId }),
        ...(b.brand !== undefined && { brand: b.brand }),
        ...(b.brandLogoUrl !== undefined && { brandLogoUrl: b.brandLogoUrl }),
        ...(b.sku !== undefined && { sku: b.sku }),
        ...(b.moq !== undefined && { moq: b.moq }),
        ...(b.stock !== undefined && { stock: b.stock }),
        ...(b.status !== undefined && { status: b.status }),
        ...(b.isFeatured !== undefined && { isFeatured: b.isFeatured }),
      },
    });

    if (b.productAssets) {
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
      }[] = [];
      if (b.retail) {
        rows.push({
          productId: id,
          customerType: 'retail',
          price: b.retail.price,
          compareAt: b.retail.compareAt ?? null,
          tier1MinQty: b.retail.tier1MinQty ?? 2,
          tier1Discount: b.retail.tier1Discount ?? 5,
          tier2MinQty: b.retail.tier2MinQty ?? 6,
          tier2Discount: b.retail.tier2Discount ?? 10,
          tier3MinQty: b.retail.tier3MinQty ?? 11,
          tier3Discount: b.retail.tier3Discount ?? 15,
        });
      }
      if (b.wholesale) {
        rows.push({
          productId: id,
          customerType: 'wholesale',
          price: b.wholesale.price,
          compareAt: b.wholesale.compareAt ?? null,
          tier1MinQty: b.wholesale.tier1MinQty ?? 1,
          tier1Discount: b.wholesale.tier1Discount ?? 2,
          tier2MinQty: b.wholesale.tier2MinQty ?? 3,
          tier2Discount: b.wholesale.tier2Discount ?? 5,
          tier3MinQty: b.wholesale.tier3MinQty ?? 6,
          tier3Discount: b.wholesale.tier3Discount ?? 8,
        });
      }
      if (rows.length) await tx.productPricing.createMany({ data: rows });
    }
  });

  const product = await prisma.product.findUnique({
    where: { id },
    include: { pricing: true, productAssets: { orderBy: { sortOrder: 'asc' } }, category: true },
  });
  res.json({ product });
});

// ─── Move product (drag-drop category change) ────────────────────────────────

router.patch('/products/:id/category', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { categoryId } = req.body as { categoryId: string };
  if (!categoryId) {
    res.status(400).json({ error: 'categoryId required' });
    return;
  }
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  const product = await prisma.product.update({
    where: { id: routeParam(req.params.id) },
    data: { categoryId },
    include: { category: true },
  });
  res.json({ product });
});

// ─── Categories update / delete ──────────────────────────────────────────────

router.put('/categories/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { nameEn, nameBn, parentId, icon, sortOrder } = req.body as {
    nameEn?: string;
    nameBn?: string;
    parentId?: string | null;
    icon?: string | null;
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
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  res.json({ category });
});

router.delete('/categories/:id', requireRole('super_admin'), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const [childCount, prodCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);
  if (childCount > 0 || prodCount > 0) {
    res.status(400).json({ error: 'Remove subcategories and products first' });
    return;
  }
  await prisma.category.delete({ where: { id } });
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

export default router;
