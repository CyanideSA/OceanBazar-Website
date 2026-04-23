import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

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
  res.json({ disputes, total, page, limit });
});

// GET /api/admin/disputes/:id
router.get('/:id', async (req: Request, res: Response) => {
  const dispute = await prisma.disputes.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!dispute) { res.status(404).json({ error: 'Dispute not found' }); return; }
  res.json({ dispute });
});

// POST /api/admin/disputes
router.post('/', async (req: Request, res: Response) => {
  const { order_id, user_id, title, description, priority } = req.body;
  if (!order_id || !user_id || !title) { res.status(400).json({ error: 'order_id, user_id, title required' }); return; }

  const dispute = await prisma.disputes.create({
    data: {
      id: uuidv4(),
      order_id,
      user_id,
      title,
      description,
      priority: priority || 'medium',
    },
  });
  res.status(201).json({ dispute });
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

  res.json({ dispute });
});

// POST /api/admin/disputes/:id/escalate
router.post('/:id/escalate', async (req: Request, res: Response) => {
  const dispute = await prisma.disputes.update({
    where: { id: routeParam(req.params.id) },
    data: { priority: 'high', status: 'open', updated_at: new Date() },
  });
  res.json({ dispute, message: 'Escalated to high priority' });
});

export default router;
