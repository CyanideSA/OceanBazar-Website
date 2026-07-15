import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAdmin, requireRole } from '../../middleware/auth';
import { routeParam } from '../../utils/params';
import { uploadImage } from '../../services/cloudinaryService';
import {
  getSearchAnalytics,
  getRolePermissions,
  isSuperAdmin,
  listPendingChanges,
  reviewPendingChange,
  saveRolePermissions,
  getAdminFromReq,
} from '../../lib/adminGovernance';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** GET /api/admin/governance/permissions/all */
router.get('/permissions/all', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [admin, staff] = await Promise.all([
      getRolePermissions('admin'),
      getRolePermissions('staff'),
    ]);
    res.json({ admin: admin || {}, staff: staff || {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/governance/pending */
router.get('/pending', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || 'pending');
    const items = await listPendingChanges(status, 200);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/governance/pending/:id/review */
router.post('/pending/:id/review', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { approve, note, reapply } = req.body as { approve?: boolean; note?: string; reapply?: boolean };
  try {
    const result = await reviewPendingChange(id, !!approve, getAdminFromReq(req).adminId || '', note);
    if (!result.ok) {
      res.status(404).json(result);
      return;
    }
    if (approve && reapply && result.row) {
      // Re-apply is module-specific; client can trigger after approval for now
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/governance/permissions/:role */
router.get('/permissions/:role', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const role = routeParam(req.params.role);
    const custom = await getRolePermissions(role);
    res.json({ role, permissions: custom });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/admin/governance/permissions/:role */
router.put('/permissions/:role', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const role = routeParam(req.params.role);
    if (role === 'super_admin') {
      res.status(400).json({ error: 'Super Admin permissions cannot be restricted' });
      return;
    }
    await saveRolePermissions(role, req.body.permissions, getAdminFromReq(req).adminId || '');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/governance/search-analytics */
router.get('/search-analytics', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const data = await getSearchAnalytics(500, 0);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/governance/profile-image */
router.post('/profile-image', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  const adminId = getAdminFromReq(req).adminId;
  // #region agent log
  fetch('http://127.0.0.1:7768/ingest/4878ed05-f1ac-4ebb-915b-84a7969025f6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'74a2e3'},body:JSON.stringify({sessionId:'74a2e3',hypothesisId:'C',location:'governance.ts:profile-image',message:'admin profile upload',data:{adminId:adminId??null,hasFile:!!req.file},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const adminIdNum = Number(adminId);
  try {
    if (!req.file) {
      await prisma.$executeRaw`UPDATE admin_users SET profile_image = NULL WHERE id = ${adminIdNum}`;
      res.json({ ok: true, profileImage: null });
      return;
    }
    const uploaded = await uploadImage(req.file.buffer, 'oceanbazar/admin-avatars', { publicId: req.file.originalname });
    const url = uploaded.secureUrl;
    await prisma.$executeRaw`UPDATE admin_users SET profile_image = ${url} WHERE id = ${adminIdNum}`;
    res.json({ ok: true, profileImage: url });
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7768/ingest/4878ed05-f1ac-4ebb-915b-84a7969025f6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'74a2e3'},body:JSON.stringify({sessionId:'74a2e3',hypothesisId:'C',location:'governance.ts:profile-image:catch',message:'admin profile upload failed',data:{detail:err?.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/admin/governance/profile-image */
router.delete('/profile-image', requireAdmin, async (req: Request, res: Response) => {
  const adminId = getAdminFromReq(req).adminId;
  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const adminIdNum = Number(adminId);
  try {
    await prisma.$executeRaw`UPDATE admin_users SET profile_image = NULL WHERE id = ${adminIdNum}`;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
