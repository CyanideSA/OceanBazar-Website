import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// ─── Wholesale Applications ──────────────────────────────────────────────────

// GET /api/admin/applications/wholesale
router.get('/wholesale', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;

  const [applications, total] = await Promise.all([
    prisma.wholesale_applications.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.wholesale_applications.count({ where }),
  ]);
  res.json({ applications, total, page, limit });
});

// GET /api/admin/applications/wholesale/:id
router.get('/wholesale/:id', async (req: Request, res: Response) => {
  const app = await prisma.wholesale_applications.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!app) { res.status(404).json({ error: 'Application not found' }); return; }
  res.json({ application: app });
});

// PATCH /api/admin/applications/wholesale/:id — approve/reject
router.patch('/wholesale/:id', async (req: Request, res: Response) => {
  const { status, admin_notes } = req.body;
  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    res.status(400).json({ error: 'status must be approved, rejected, or pending' });
    return;
  }

  const updated = await prisma.wholesale_applications.update({
    where: { id: routeParam(req.params.id) },
    data: {
      status,
      admin_notes: admin_notes || undefined,
      reviewed_by_admin_id: String(req.admin!.adminId),
      reviewed_at: new Date(),
      updated_at: new Date(),
    },
  });

  // If approved, upgrade user to wholesale
  if (status === 'approved' && updated.user_id) {
    await prisma.user.updateMany({
      where: { id: updated.user_id },
      data: { userType: 'wholesale' },
    });
  }

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: `WHOLESALE_${status.toUpperCase()}`, targetType: 'wholesale_application', targetId: updated.id, details: { admin_notes } },
  });

  res.json({ application: updated });
});

// ─── Business Inquiries ──────────────────────────────────────────────────────

// GET /api/admin/applications/business
router.get('/business', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;

  const [inquiries, total] = await Promise.all([
    prisma.business_inquiries.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.business_inquiries.count({ where }),
  ]);
  res.json({ inquiries, total, page, limit });
});

// GET /api/admin/applications/business/:id
router.get('/business/:id', async (req: Request, res: Response) => {
  const inq = await prisma.business_inquiries.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!inq) { res.status(404).json({ error: 'Inquiry not found' }); return; }
  res.json({ inquiry: inq });
});

// PATCH /api/admin/applications/business/:id
router.patch('/business/:id', async (req: Request, res: Response) => {
  const { status, admin_notes } = req.body;
  const updated = await prisma.business_inquiries.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(admin_notes !== undefined && { admin_notes }),
      reviewed_by_admin_id: String(req.admin!.adminId),
      reviewed_at: new Date(),
      updated_at: new Date(),
    },
  });
  res.json({ inquiry: updated });
});

// ─── Seller Applications ─────────────────────────────────────────────────────

// GET /api/admin/applications/sellers
router.get('/sellers', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;

  const [sellers, total] = await Promise.all([
    prisma.sellers.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.sellers.count({ where }),
  ]);
  res.json({ sellers, total, page, limit });
});

// PATCH /api/admin/applications/sellers/:id
router.patch('/sellers/:id', async (req: Request, res: Response) => {
  const { status, verification_status, commission_rate } = req.body;
  const updated = await prisma.sellers.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(verification_status && { verification_status }),
      ...(commission_rate !== undefined && { commission_rate }),
      ...(status === 'approved' && { approved_by_admin_id: String(req.admin!.adminId), approved_at: new Date() }),
      updated_at: new Date(),
    },
  });
  res.json({ seller: updated });
});

export default router;
