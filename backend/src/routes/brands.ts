import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../utils/params';
import { cacheResponse } from '../cache/cacheMiddleware';

const router = Router();
const prisma = new PrismaClient();
const brandCache = cacheResponse({ ttlSeconds: 1800, keyPrefix: 'bff:brands' });

// GET /api/brands — active brands for storefront (cached 30 min)
router.get('/', brandCache, async (_req: Request, res: Response) => {
  const brands = await prisma.brand.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      slug: true,
      logoUrl: true,
      _count: { select: { products: { where: { status: 'active' } } } },
    },
  });
  res.json({
    brands: brands.map((b) => ({
      id: b.id,
      nameEn: b.nameEn,
      nameBn: b.nameBn,
      slug: b.slug,
      logoUrl: b.logoUrl,
      productCount: b._count.products,
    })),
  });
});

// GET /api/brands/:slugOrId — by slug (preferred) or 8-char id
router.get('/:slugOrId', async (req: Request, res: Response) => {
  const key = routeParam(req.params.slugOrId);
  const isId = /^[a-f0-9]{8}$/i.test(key);
  const brand = await prisma.brand.findFirst({
    where: isId ? { id: key } : { slug: key },
    include: {
      products: {
        where: { status: 'active' },
        take: 48,
        orderBy: { createdAt: 'desc' },
        include: {
          productAssets: { where: { isPrimary: true }, take: 1 },
          pricing: true,
          category: true,
        },
      },
    },
  });
  if (!brand) {
    res.status(404).json({ error: 'Brand not found' });
    return;
  }
  const products = brand.products.map((p) => {
    const retail = p.pricing.find((x) => x.customerType === 'retail');
    const img = p.productAssets[0];
    return {
      id: p.id,
      titleEn: p.titleEn,
      titleBn: p.titleBn,
      primaryImage: img?.url ?? null,
      retailPrice: retail != null ? Number(retail.price) : null,
      categoryId: p.categoryId,
    };
  });

  res.json({
    brand: {
      id: brand.id,
      nameEn: brand.nameEn,
      nameBn: brand.nameBn,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
    },
    products,
  });
});

export default router;
