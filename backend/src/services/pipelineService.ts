import { DealStatus } from '@prisma/client';
import { generateEntityId } from '../utils/hexId';
import { prisma } from '../lib/prisma';


const DEFAULT_STAGES = [
  { name: 'Lead', winProbability: 10 },
  { name: 'Qualified', winProbability: 30 },
  { name: 'Proposal', winProbability: 55 },
  { name: 'Negotiation', winProbability: 75 },
  { name: 'Won', winProbability: 100, isWon: true },
  { name: 'Lost', winProbability: 0, isLost: true },
];

/** Returns the default pipeline, creating a seeded one on first use. */
export async function ensureDefaultPipeline() {
  let pipeline = await prisma.salesPipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  if (pipeline) return pipeline;

  const id = generateEntityId();
  await prisma.salesPipeline.create({
    data: {
      id,
      name: 'Wholesale Sales Pipeline',
      description: 'Default B2B / wholesale deal pipeline',
      isDefault: true,
      stages: {
        create: DEFAULT_STAGES.map((s, i) => ({
          id: generateEntityId(),
          name: s.name,
          position: i,
          winProbability: s.winProbability,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
        })),
      },
    },
  });
  pipeline = await prisma.salesPipeline.findUnique({
    where: { id },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  return pipeline!;
}

export async function listPipelines() {
  await ensureDefaultPipeline();
  return prisma.salesPipeline.findMany({
    include: { stages: { orderBy: { position: 'asc' } }, _count: { select: { deals: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createPipeline(input: { name: string; description?: string; stages?: string[] }) {
  const id = generateEntityId();
  const stageNames = input.stages?.length ? input.stages : DEFAULT_STAGES.map((s) => s.name);
  return prisma.salesPipeline.create({
    data: {
      id,
      name: input.name,
      description: input.description ?? null,
      stages: {
        create: stageNames.map((name, i) => ({
          id: generateEntityId(),
          name,
          position: i,
          winProbability: Math.round((i / Math.max(stageNames.length - 1, 1)) * 100),
        })),
      },
    },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
}

export async function listDeals(opts: { pipelineId?: string; status?: string } = {}) {
  const pipeline = opts.pipelineId
    ? await prisma.salesPipeline.findUnique({ where: { id: opts.pipelineId }, include: { stages: { orderBy: { position: 'asc' } } } })
    : await ensureDefaultPipeline();
  if (!pipeline) return { pipeline: null, stages: [], deals: [] };

  const deals = await prisma.deal.findMany({
    where: {
      pipelineId: pipeline.id,
      ...(opts.status ? { status: opts.status as DealStatus } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  return { pipeline: { id: pipeline.id, name: pipeline.name }, stages: pipeline.stages, deals };
}

export async function createDeal(input: {
  pipelineId?: string;
  stageId?: string;
  customerId?: string;
  title: string;
  value?: number;
  currency?: string;
  ownerAdminId?: number;
  expectedCloseAt?: string;
  notes?: string;
}) {
  const pipeline = input.pipelineId
    ? await prisma.salesPipeline.findUnique({ where: { id: input.pipelineId }, include: { stages: { orderBy: { position: 'asc' } } } })
    : await ensureDefaultPipeline();
  if (!pipeline) throw new Error('pipeline_not_found');
  const stageId = input.stageId || pipeline.stages[0]?.id;
  if (!stageId) throw new Error('no_stage');
  if (input.customerId && input.customerId.length !== 8) {
    throw new Error('customerId must be exactly 8 characters');
  }

  return prisma.deal.create({
    data: {
      id: generateEntityId(),
      pipelineId: pipeline.id,
      stageId,
      customerId: input.customerId ?? null,
      title: input.title,
      value: input.value ?? 0,
      currency: input.currency || 'BDT',
      ownerAdminId: input.ownerAdminId ?? null,
      expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
      notes: input.notes ?? null,
    },
  });
}

export async function deleteDeal(id: string) {
  return prisma.deal.delete({ where: { id } });
}

export async function updateDeal(id: string, input: {
  stageId?: string;
  status?: string;
  value?: number;
  title?: string;
  notes?: string;
  expectedCloseAt?: string | null;
}) {
  return prisma.deal.update({
    where: { id },
    data: {
      ...(input.stageId ? { stageId: input.stageId } : {}),
      ...(input.status ? { status: input.status as DealStatus } : {}),
      ...(input.value != null ? { value: input.value } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.expectedCloseAt !== undefined
        ? { expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null }
        : {}),
    },
  });
}
