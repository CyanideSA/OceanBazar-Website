import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { routeParam } from '../utils/params';
import { cacheResponse } from '../cache/cacheMiddleware';
import { BrandListResponseSchema } from '../contracts/brand.contract';
import { parseContract } from '../lib/contractValidate';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;
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
  res.json(
    parseContract(
      BrandListResponseSchema,
      {
        brands: brands.map((b) => ({
          id: b.id,
          nameEn: b.nameEn,
          nameBn: b.nameBn,
          slug: b.slug,
          logoUrl: b.logoUrl,
          productCount: b._count.products,
        })),
      },
      'brands.list'
    )
  );
});

// GET /api/brands/:slugOrId — by slug (preferred) or 8-char id
router.get('/:slugOrId', async (req: Request, res: Response) => {
  const key = routeParam(req.params.slugOrId);
  const isId = /^[a-f0-9]{8}$/i.test(key);
  const brand = await prismaAny.brand.findFirst({
    where: isId ? { id: key } : { slug: key },
    include: {
      products: {
        where: { status: 'active' },
        take: 48,
        orderBy: { createdAt: 'desc' },
        include: {
          productAssets: { where: { isPrimary: true }, take: 1 },
          pricing: true,
          productCategories: { include: { category: true } },
        },
      },
    },
  });
  if (!brand) {
    res.status(404).json({ error: 'Brand not found' });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (brand.products as any[]).map((p: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retail = (p.pricing as any[]).find((x: any) => x.customerType === 'retail');
    const img = p.productAssets[0];
    const catMaps = (p.productCategories ?? []) as Array<{ isPrimary: boolean; category: { id: string } }>;
    const primaryCat = catMaps.find((m) => m.isPrimary) ?? catMaps[0];
    return {
      id: p.id,
      titleEn: p.titleEn,
      titleBn: p.titleBn,
      primaryImage: img?.url ?? null,
      retailPrice: retail != null ? Number(retail.price) : null,
      categoryId: primaryCat?.category?.id ?? null,
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
