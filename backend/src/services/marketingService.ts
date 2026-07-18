import { CampaignStatus, CommChannel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { generateMarketing, isMlConfigured, type MarketingGeneration } from './mlClient';
import { prisma } from '../lib/prisma';


// ─── Audience resolution ────────────────────────────────────────────────────

export interface AudienceSpec {
  type?: 'all' | 'segment' | 'churn_risk' | 'high_value';
  segments?: string[];
  minChurnScore?: number;
  minLtv?: number;
  limit?: number;
}

/** Resolves an audience spec to a list of customers (userId + email + name). */
export async function resolveAudience(spec: AudienceSpec = {}) {
  const limit = Math.min(spec.limit ?? 5000, 20000);
  const type = spec.type ?? 'all';

  if (type === 'segment' || type === 'churn_risk' || type === 'high_value') {
    const preds = await prisma.mlPrediction.findMany({
      where: {
        subjectType: 'customer',
        ...(type === 'segment' && spec.segments?.length ? { segment: { in: spec.segments } } : {}),
        ...(type === 'churn_risk' ? { churnScore: { gte: spec.minChurnScore ?? 0.6 } } : {}),
        ...(type === 'high_value' ? { predictedLtv: { gte: spec.minLtv ?? 0 } } : {}),
      },
      orderBy: type === 'high_value' ? { predictedLtv: 'desc' } : { churnScore: 'desc' },
      take: limit,
      select: { subjectId: true },
    });
    const ids = preds.map((p) => p.subjectId);
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, email: { not: null } },
      select: { id: true, name: true, email: true },
    });
    return users;
  }

  // type === 'all'
  return prisma.user.findMany({
    where: { email: { not: null } },
    select: { id: true, name: true, email: true },
    take: limit,
  });
}

export async function previewAudience(spec: AudienceSpec) {
  const users = await resolveAudience({ ...spec, limit: Math.min(spec.limit ?? 50, 50) });
  const total = await resolveAudience({ ...spec, limit: 20000 });
  return {
    estimatedSize: total.length,
    sample: users.slice(0, 25).map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}

// ─── AI generation ──────────────────────────────────────────────────────────

export async function generateCampaignCopy(input: {
  kind: string;
  topic: string;
  audience?: string;
  tone?: string;
  language?: string;
  productName?: string;
  extraContext?: string;
}): Promise<MarketingGeneration & { mlConfigured: boolean }> {
  if (isMlConfigured()) {
    try {
      const result = await generateMarketing({
        kind: input.kind,
        topic: input.topic,
        audience: input.audience,
        tone: input.tone,
        language: input.language,
        product_name: input.productName,
        extra_context: input.extraContext,
      });
      return { ...result, mlConfigured: true };
    } catch {
      /* fall through to heuristic */
    }
  }
  return { ...heuristicCopy(input), mlConfigured: false };
}

function heuristicCopy(input: { kind: string; topic: string; tone?: string; productName?: string }): MarketingGeneration {
  const subject = `${input.topic}${input.productName ? ` — ${input.productName}` : ''}`;
  const body = [
    `Hi {{name}},`,
    '',
    `We thought you'd love this: ${input.topic}.`,
    input.productName ? `Check out ${input.productName} — now available on OceanBazar.` : 'Discover great deals curated just for you on OceanBazar.',
    '',
    'Shop now and enjoy fast delivery across Bangladesh.',
    '',
    '— The OceanBazar Team',
  ].join('\n');
  return { source: 'heuristic', subject, body };
}

// ─── Campaign CRUD ──────────────────────────────────────────────────────────

export async function listCampaigns(opts: { status?: string } = {}) {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: opts.status ? { status: opts.status as CampaignStatus } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { steps: true, enrollments: true } },
    },
  });
  return campaigns;
}

export async function getCampaign(id: string) {
  return prisma.marketingCampaign.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { position: 'asc' } },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function createCampaign(input: {
  name: string;
  description?: string;
  channel?: CommChannel;
  audience?: AudienceSpec;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  createdByAdminId?: number;
  steps?: Array<{
    subject?: string;
    body?: string;
    bodyHtml?: string;
    designJson?: unknown;
    delayHours?: number;
    channel?: CommChannel;
  }>;
}) {
  const id = uuidv4();
  return prisma.marketingCampaign.create({
    data: {
      id,
      name: input.name,
      description: input.description ?? null,
      channel: input.channel ?? 'email',
      audience: (input.audience as object) ?? undefined,
      triggerType: input.triggerType ?? 'manual',
      triggerConfig: (input.triggerConfig as object) ?? undefined,
      createdByAdminId: input.createdByAdminId ?? null,
      steps: input.steps?.length
        ? {
            create: input.steps.map((s, i) => ({
              id: uuidv4(),
              position: i,
              channel: s.channel ?? 'email',
              delayHours: s.delayHours ?? 0,
              subject: s.subject ?? null,
              body: s.bodyHtml ?? s.body ?? null,
              metadata: s.bodyHtml || s.designJson
                ? { bodyHtml: s.bodyHtml ?? s.body ?? null, designJson: s.designJson ?? null }
                : undefined,
            })),
          }
        : undefined,
    },
    include: { steps: { orderBy: { position: 'asc' } } },
  });
}

export async function updateCampaign(
  id: string,
  input: {
    name?: string;
    description?: string;
    status?: string;
    audience?: AudienceSpec;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    startsAt?: string | null;
    endsAt?: string | null;
    steps?: Array<{
      subject?: string;
      body?: string;
      bodyHtml?: string;
      designJson?: unknown;
      delayHours?: number;
      channel?: CommChannel;
    }>;
  }
) {
  // Replace steps if provided (simple, atomic).
  if (input.steps) {
    await prisma.campaignStep.deleteMany({ where: { campaignId: id } });
    await prisma.campaignStep.createMany({
      data: input.steps.map((s, i) => ({
        id: uuidv4(),
        campaignId: id,
        position: i,
        channel: s.channel ?? 'email',
        delayHours: s.delayHours ?? 0,
        subject: s.subject ?? null,
        body: s.bodyHtml ?? s.body ?? null,
        metadata: s.bodyHtml || s.designJson
          ? { bodyHtml: s.bodyHtml ?? s.body ?? null, designJson: s.designJson ?? null }
          : undefined,
      })),
    });
  }
  return prisma.marketingCampaign.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status ? { status: input.status as CampaignStatus } : {}),
      ...(input.audience ? { audience: input.audience as object } : {}),
      ...(input.triggerType ? { triggerType: input.triggerType } : {}),
      ...(input.triggerConfig ? { triggerConfig: input.triggerConfig as object } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
    },
    include: { steps: { orderBy: { position: 'asc' } } },
  });
}

export async function deleteCampaign(id: string) {
  await prisma.marketingCampaign.delete({ where: { id } });
  return { ok: true };
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

/** Enrolls the campaign's resolved audience into its journey. */
export async function enrollAudience(campaignId: string) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: { steps: { orderBy: { position: 'asc' } } },
  });
  if (!campaign) throw new Error('campaign_not_found');
  if (!campaign.steps.length) throw new Error('campaign_has_no_steps');

  const audience = await resolveAudience((campaign.audience as AudienceSpec) ?? {});
  const firstDelay = campaign.steps[0]?.delayHours ?? 0;
  const nextRunAt = new Date(Date.now() + firstDelay * 3600 * 1000);

  let enrolled = 0;
  for (const user of audience) {
    try {
      await prisma.campaignEnrollment.create({
        data: {
          id: uuidv4(),
          campaignId,
          customerId: user.id,
          currentStep: 0,
          status: 'active',
          nextRunAt,
        },
      });
      enrolled += 1;
    } catch {
      // unique constraint — already enrolled, skip
    }
  }

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: 'active' },
  });

  return { enrolled, audienceSize: audience.length };
}
