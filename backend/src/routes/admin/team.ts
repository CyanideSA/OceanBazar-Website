import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireRole } from '../../middleware/auth';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/team/members
router.get('/members', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const members = await prisma.adminUser.findMany({
    select: { id: true, name: true, username: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
  const total = await prisma.adminUser.count();
  res.json({ members, total, page, limit });
});

// GET /api/admin/team/members/:id
router.get('/members/:id', async (req: Request, res: Response) => {
  const member = await prisma.adminUser.findUnique({
    where: { id: parseInt(routeParam(req.params.id)) },
    select: { id: true, name: true, username: true, email: true, role: true, active: true, createdAt: true },
  });
  if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
  res.json({ member });
});

// POST /api/admin/team/members — create staff/admin
router.post('/members', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { name, username, email, password, role } = req.body;
  if (!name || !username || !email || !password) {
    res.status(400).json({ error: 'name, username, email, password required' });
    return;
  }

  // Only super_admin can create admin/super_admin
  const callerRole = req.admin!.role;
  if (role === 'super_admin' && callerRole !== 'super_admin') {
    res.status(403).json({ error: 'Only super_admin can create super_admin accounts' });
    return;
  }

  const existing = await prisma.adminUser.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) { res.status(409).json({ error: 'Username or email already exists' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const member = await prisma.adminUser.create({
    data: { name, username, email, passwordHash, role: (role as 'super_admin' | 'admin' | 'staff') || 'staff' },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'CREATE_TEAM_MEMBER', targetType: 'admin_user', targetId: String(member.id), details: { username, role: member.role } },
  });

  res.status(201).json({ member: { id: member.id, name: member.name, username: member.username, email: member.email, role: member.role } });
});

// PUT /api/admin/team/members/:id — edit role/details
router.put('/members/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { name, email, role, active } = req.body;
  const targetId = parseInt(routeParam(req.params.id));

  // Prevent non-super_admin from editing super_admins
  if (req.admin!.role !== 'super_admin') {
    const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
    if (target?.role === 'super_admin') {
      res.status(403).json({ error: 'Cannot edit super_admin accounts' });
      return;
    }
  }

  const member = await prisma.adminUser.update({
    where: { id: targetId },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role: role as 'super_admin' | 'admin' | 'staff' }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_TEAM_MEMBER', targetType: 'admin_user', targetId: String(member.id), details: { name, email, role, active } },
  });

  res.json({ member: { id: member.id, name: member.name, username: member.username, email: member.email, role: member.role, active: member.active } });
});

// PUT /api/admin/team/members/:id/password — reset password
router.put('/members/:id/password', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const targetId = parseInt(routeParam(req.params.id));
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.update({ where: { id: targetId }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'RESET_PASSWORD', targetType: 'admin_user', targetId: String(targetId), details: {} },
  });

  res.json({ message: 'Password updated' });
});

export default router;
