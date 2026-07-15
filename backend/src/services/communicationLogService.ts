import { PrismaClient, CommChannel, CommDirection } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface CommLogInput {
  customerId?: string | null;
  channel: CommChannel;
  direction?: CommDirection;
  subject?: string | null;
  body?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  status?: string;
  provider?: string | null;
  externalId?: string | null;
  refType?: string | null;
  refId?: string | null;
  adminId?: number | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records a single entry in the unified communication log.
 * Best-effort: never throws so it cannot break the calling flow.
 */
export async function logCommunication(input: CommLogInput): Promise<void> {
  try {
    await prisma.communicationLog.create({
      data: {
        id: uuidv4(),
        customerId: input.customerId ?? null,
        channel: input.channel,
        direction: input.direction ?? 'outbound',
        subject: input.subject ?? null,
        body: input.body ?? null,
        fromAddress: input.fromAddress ?? null,
        toAddress: input.toAddress ?? null,
        status: input.status ?? 'sent',
        provider: input.provider ?? null,
        externalId: input.externalId ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        adminId: input.adminId ?? null,
        metadata: (input.metadata as object) ?? undefined,
      },
    });
  } catch (err) {
    console.warn('[comm-log] failed to record:', (err as Error).message);
  }
}

/** Resolves a customer (user) id from an email address, for log attribution. */
export async function resolveCustomerIdByEmail(email?: string | null): Promise<string | null> {
  if (!email) return null;
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
    return user?.id ?? null;
  } catch {
    return null;
  }
}
