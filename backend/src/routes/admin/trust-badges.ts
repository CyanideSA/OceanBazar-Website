import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { routeParam } from '../../utils/params';

const router = Router();
const prismaAny = prisma as any;

function slugify(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function serializeBadge(row: any, productCount?: number) {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.nameEn ?? row.name_en,
    nameBn: row.nameBn ?? row.name_bn,
    icon: row.icon || 'shield',
    description: row.description || '',
    sortOrder: row.sortOrder ?? row.sort_order ?? 0,
    active: row.active !== false,
    productCount: typeof productCount === 'number' ? productCount : undefined,
  };
}

// GET /api/admin/trust-badges
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await prismaAny.trustBadge.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    res.json({
      badges: rows.map((r: any) => serializeBadge(r, r._count?.products ?? 0)),
    });
  } catch (err: any) {
    console.error('[trust-badges] list failed', err);
    res.status(500).json({ error: err?.message || 'Failed to list trust badges' });
  }
});

// POST /api/admin/trust-badges
router.post('/', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const nameEn = String(req.body?.nameEn || req.body?.label || '').trim();
    const nameBn = String(req.body?.nameBn || req.body?.labelBn || nameEn).trim();
    if (!nameEn) return res.status(400).json({ error: 'nameEn is required' });
    let slug = slugify(req.body?.slug || nameEn);
    if (!slug) slug = `badge-${Date.now()}`;

    const created = await prismaAny.trustBadge.create({
      data: {
        slug,
        nameEn,
        nameBn,
        icon: String(req.body?.icon || 'shield').slice(0, 50),
        description: String(req.body?.description || '').slice(0, 255) || null,
        sortOrder: Number(req.body?.sortOrder) || 0,
        active: req.body?.active !== false,
      },
    });
    res.status(201).json(serializeBadge(created, 0));
  } catch (err: any) {
    if (String(err?.code) === 'P2002') {
      return res.status(409).json({ error: 'A badge with that slug already exists' });
    }
    res.status(500).json({ error: err?.message || 'Failed to create badge' });
  }
});

// PUT /api/admin/trust-badges/:id
router.put('/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(routeParam(req.params.id), 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const data: Record<string, unknown> = {};
    if (req.body?.nameEn != null) data.nameEn = String(req.body.nameEn).trim();
    if (req.body?.nameBn != null) data.nameBn = String(req.body.nameBn).trim();
    if (req.body?.icon != null) data.icon = String(req.body.icon).slice(0, 50);
    if (req.body?.description != null) data.description = String(req.body.description).slice(0, 255) || null;
    if (req.body?.sortOrder != null) data.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body?.active != null) data.active = Boolean(req.body.active);
    if (req.body?.slug != null) {
      const slug = slugify(req.body.slug);
      if (slug) data.slug = slug;
    }
    const updated = await prismaAny.trustBadge.update({ where: { id }, data });
    const count = await prismaAny.productTrustBadge.count({ where: { badgeId: id } });
    res.json(serializeBadge(updated, count));
  } catch (err: any) {
    if (String(err?.code) === 'P2025') return res.status(404).json({ error: 'Badge not found' });
    res.status(500).json({ error: err?.message || 'Failed to update badge' });
  }
});

// DELETE /api/admin/trust-badges/:id
router.delete('/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(routeParam(req.params.id), 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await prismaAny.trustBadge.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    if (String(err?.code) === 'P2025') return res.status(404).json({ error: 'Badge not found' });
    res.status(500).json({ error: err?.message || 'Failed to delete badge' });
  }
});

export default router;
