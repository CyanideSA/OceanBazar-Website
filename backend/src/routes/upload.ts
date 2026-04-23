import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireAdmin, requireRole } from '../middleware/auth';
import {
  uploadImage,
  uploadLogo,
  deleteImage,
  uploadProfilePhoto,
} from '../services/cloudinaryService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ─── Public/Auth image upload ────────────────────────────────────────────────

router.post('/image', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No image file provided' }); return; }
  try {
    const folder = (req.body.folder as string) || 'general';
    const result = await uploadImage(req.file.buffer, folder);
    res.json(result);
  } catch (err: any) {
    console.error('[upload] Cloudinary error:', err.message);
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
});

// ─── Profile photo upload ────────────────────────────────────────────────────

router.post('/profile-photo', requireAuth, upload.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No photo file provided' }); return; }
  try {
    const result = await uploadProfilePhoto(req.file.buffer, req.user!.userId);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { profileImage: result.secureUrl },
    });
    res.json({ url: result.secureUrl, publicId: result.publicId });
  } catch (err: any) {
    console.error('[upload] Profile photo error:', err.message);
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
});

// ─── Admin image upload ──────────────────────────────────────────────────────

router.post('/admin/image', requireAdmin, upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No image file provided' }); return; }
  try {
    const folder = (req.body.folder as string) || 'admin';
    const result = await uploadImage(req.file.buffer, folder);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
});

// ─── Admin logo upload (super_admin only) ────────────────────────────────────

router.post(
  '/admin/logo',
  requireAdmin,
  requireRole('super_admin'),
  upload.single('logo'),
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: 'No logo file provided' }); return; }
    const type = (req.body.type as 'dark' | 'light' | 'favicon') || 'dark';
    if (!['dark', 'light', 'favicon'].includes(type)) {
      res.status(400).json({ error: 'type must be dark, light, or favicon' });
      return;
    }
    try {
      const result = await uploadLogo(req.file.buffer, type);
      const fieldMap: Record<string, string> = {
        dark: 'logo_dark_url',
        light: 'logo_light_url',
        favicon: 'favicon_url',
      };
      await prisma.site_settings.upsert({
        where: { id: 'default' },
        create: { id: 'default', [fieldMap[type]]: result.secureUrl },
        update: { [fieldMap[type]]: result.secureUrl, updated_at: new Date() },
      });
      res.json({ url: result.secureUrl, publicId: result.publicId, type });
    } catch (err: any) {
      res.status(500).json({ error: 'Logo upload failed', detail: err.message });
    }
  }
);

// ─── Delete image ────────────────────────────────────────────────────────────

router.delete('/image/:publicId(*)', requireAdmin, async (req: Request, res: Response) => {
  try {
    const publicId = Array.isArray(req.params.publicId) ? req.params.publicId[0] : req.params.publicId;
    const result = await deleteImage(publicId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

export default router;
