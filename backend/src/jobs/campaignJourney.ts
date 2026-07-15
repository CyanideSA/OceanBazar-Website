import { PrismaClient } from '@prisma/client';
import { appLog } from '../lib/appLog';
import { sendMail, emailWrapper } from '../services/emailService';
import { logCommunication } from '../services/communicationLogService';

const prisma = new PrismaClient();

const BATCH = 100;

function renderTemplate(text: string | null | undefined, vars: Record<string, string>): string {
  if (!text) return '';
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Processes due campaign enrollments: sends the current step, logs it,
 * then advances to the next step or completes the journey.
 */
export async function runCampaignJourney(): Promise<void> {
  const now = new Date();
  const due = await prisma.campaignEnrollment.findMany({
    where: { status: 'active', nextRunAt: { lte: now } },
    take: BATCH,
    include: { campaign: { include: { steps: { orderBy: { position: 'asc' } } } } },
  });

  if (!due.length) return;

  let sent = 0;
  let completed = 0;

  for (const enr of due) {
    const campaign = enr.campaign;
    if (!campaign || campaign.status !== 'active') {
      await prisma.campaignEnrollment.update({ where: { id: enr.id }, data: { status: 'cancelled' } });
      continue;
    }
    const step = campaign.steps.find((s) => s.position === enr.currentStep);
    if (!step) {
      await prisma.campaignEnrollment.update({
        where: { id: enr.id },
        data: { status: 'completed', completedAt: now },
      });
      completed += 1;
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: enr.customerId },
      select: { id: true, name: true, email: true },
    });

    if (user?.email && step.channel === 'email') {
      const vars = { name: user.name ?? 'there', email: user.email };
      const subject = renderTemplate(step.subject, vars) || campaign.name;
      const bodyText = renderTemplate(step.body, vars);
      const html = emailWrapper(`<p>${bodyText.replace(/\n/g, '<br/>')}</p>`);
      try {
        const ok = await sendMail(user.email, subject, html, `campaign_${campaign.id}`);
        await logCommunication({
          customerId: user.id,
          channel: 'email',
          direction: 'outbound',
          subject,
          body: bodyText,
          toAddress: user.email,
          status: ok ? 'sent' : 'failed',
          refType: 'marketing_campaign',
          refId: campaign.id,
          metadata: { step: step.position },
        });
        if (ok) sent += 1;
      } catch (e) {
        appLog('warn', 'campaign_step_send_failed', {
          campaignId: campaign.id,
          enrollmentId: enr.id,
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Advance to next step or complete.
    const nextStep = campaign.steps.find((s) => s.position === enr.currentStep + 1);
    if (nextStep) {
      await prisma.campaignEnrollment.update({
        where: { id: enr.id },
        data: {
          currentStep: nextStep.position,
          nextRunAt: new Date(now.getTime() + (nextStep.delayHours ?? 0) * 3600 * 1000),
        },
      });
    } else {
      await prisma.campaignEnrollment.update({
        where: { id: enr.id },
        data: { status: 'completed', completedAt: now },
      });
      completed += 1;
    }
  }

  appLog('info', 'campaign_journey_processed', { due: due.length, sent, completed });
}

export function startCampaignJourneyCron(): void {
  if (process.env.CAMPAIGN_JOURNEY_CRON === 'false') return;
  const intervalMin = Number(process.env.CAMPAIGN_JOURNEY_INTERVAL_MIN ?? 15);
  setInterval(() => void runCampaignJourney(), intervalMin * 60 * 1000);
  // First run shortly after boot.
  setTimeout(() => void runCampaignJourney(), 60 * 1000);
  appLog('info', 'campaign_journey_cron_started', { intervalMin });
}
