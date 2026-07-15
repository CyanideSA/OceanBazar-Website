import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const templates = await prisma.emailTemplate.findMany({
    where: category ? { category } : undefined,
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ templates });
});

router.get('/:id', async (req: Request, res: Response) => {
  const template = await prisma.emailTemplate.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!template) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ template });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, subject, bodyHtml, category, variables } = req.body;
  if (!name || !subject || !bodyHtml || !category) {
    res.status(400).json({ error: 'name, subject, bodyHtml, category required' });
    return;
  }
  const template = await prisma.emailTemplate.create({
    data: {
      id: uuidv4(),
      name,
      subject,
      bodyHtml,
      category,
      variables: variables || null,
      updatedBy: String((req as any).admin?.adminId || 'admin'),
    },
  });
  res.status(201).json({ template });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, subject, bodyHtml, category, variables } = req.body;
  const template = await prisma.emailTemplate.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(name != null ? { name } : {}),
      ...(subject != null ? { subject } : {}),
      ...(bodyHtml != null ? { bodyHtml } : {}),
      ...(category != null ? { category } : {}),
      ...(variables !== undefined ? { variables } : {}),
      updatedBy: String((req as any).admin?.adminId || 'admin'),
    },
  });
  res.json({ template });
});

router.delete('/:id', async (req: Request, res: Response) => {
  await prisma.emailTemplate.delete({ where: { id: routeParam(req.params.id) } });
  res.json({ ok: true });
});

export default router;
