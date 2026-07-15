import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

const normalizeDispute = (d: any) => ({
  id: d.id,
  orderId: d.order_id ?? null,
  userId: d.user_id ?? null,
  title: d.title,
  description: d.description ?? null,
  status: d.status,
  priority: d.priority,
  assignedToAdminId: d.assigned_to_admin_id ?? null,
  resolutionNote: d.resolution_note ?? null,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

// GET /api/admin/disputes
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status, priority, search } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (search) where.OR = [
    { order_id: { contains: search } },
    { title: { contains: search, mode: 'insensitive' } },
    { id: { contains: search } },
  ];

  const [disputes, total] = await Promise.all([
    prisma.disputes.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.disputes.count({ where }),
  ]);
  res.json({ disputes: disputes.map(normalizeDispute), total, page, limit });
});

// GET /api/admin/disputes/:id
router.get('/:id', async (req: Request, res: Response) => {
  const dispute = await prisma.disputes.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!dispute) { res.status(404).json({ error: 'Dispute not found' }); return; }
  res.json({ dispute: normalizeDispute(dispute) });
});

// POST /api/admin/disputes
router.post('/', async (req: Request, res: Response) => {
  const { order_id, user_id, title, description, priority, status } = req.body;
  if (!title) { res.status(400).json({ error: 'title required' }); return; }

  const dispute = await prisma.disputes.create({
    data: {
      id: uuidv4(),
      order_id: order_id || 'internal',
      user_id: user_id || String(req.admin!.adminId),
      title,
      description: description || null,
      priority: priority || 'medium',
      status: status || 'open',
    },
  });
  res.status(201).json({ dispute: normalizeDispute(dispute) });
});

// PATCH /api/admin/disputes/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { status, priority, assigned_to_admin_id, resolution_note } = req.body;
  const dispute = await prisma.disputes.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigned_to_admin_id !== undefined && { assigned_to_admin_id }),
      ...(resolution_note !== undefined && { resolution_note }),
      updated_at: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_DISPUTE', targetType: 'dispute', targetId: dispute.id, details: { status, priority } },
  });

  res.json({ dispute: normalizeDispute(dispute) });
});

// POST /api/admin/disputes/:id/escalate
router.post('/:id/escalate', async (req: Request, res: Response) => {
  const dispute = await prisma.disputes.update({
    where: { id: routeParam(req.params.id) },
    data: { priority: 'high', status: 'open', updated_at: new Date() },
  });
  res.json({ dispute: normalizeDispute(dispute), message: 'Escalated to high priority' });
});

// DELETE /api/admin/disputes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await prisma.disputes.delete({ where: { id: routeParam(req.params.id) } });
  res.json({ message: 'Dispute deleted' });
});

export default router;
