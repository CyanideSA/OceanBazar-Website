import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

/** GET /api/admin/client-errors */
router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = 25;
  const [reports, total] = await Promise.all([
    prisma.clientErrorReport.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.clientErrorReport.count(),
  ]);
  res.json({ reports, total, page, limit });
});

/** GET /api/admin/client-errors/:id */
router.get('/:id', async (req: Request, res: Response) => {
  const report = await prisma.clientErrorReport.findUnique({
    where: { id: routeParam(req.params.id) },
  });
  if (!report) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ report });
});

/** POST /api/admin/client-errors/:id/reviewed */
router.post('/:id/reviewed', async (req: Request, res: Response) => {
  const report = await prisma.clientErrorReport.update({
    where: { id: routeParam(req.params.id) },
    data: { reviewedAt: new Date() },
  });
  res.json({ report });
});

export default router;
