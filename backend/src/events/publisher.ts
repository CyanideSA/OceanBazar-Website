import { prisma } from '../lib/prisma';

import { getRedisClient } from '../cache/redisClient';
import { appLog } from '../lib/appLog';
import { createDomainEvent, type DomainEvent, type DomainEventType } from './domain-events';

const EVENTS_STREAM = 'ob:events';
const MAX_DLQ_ATTEMPTS = 8;

export async function publishDomainEvent<T extends Record<string, unknown>>(
  type: DomainEventType,
  payload: T,
  meta?: { aggregateId?: string; userId?: string }
): Promise<DomainEvent<T>> {
  const event = createDomainEvent(type, payload, meta);

  let redisPublished = false;
  try {
    const redis = await getRedisClient();
    await redis.xAdd(EVENTS_STREAM, '*', {
      type: event.type,
      id: event.id,
      body: JSON.stringify(event),
    });
    redisPublished = true;
  } catch (e) {
    await enqueueDeadLetter(event, e, 'redis_publish_failed');
  }

  setImmediate(() => {
    void runConsumersSafely(event).catch((err) => {
      void enqueueDeadLetter(event, err, 'consumer_pipeline_failed');
    });
  });

  if (!redisPublished) {
    appLog('warn', 'domain_event_redis_only_dlq', { type: event.type, id: event.id });
  }

  return event;
}

async function runConsumersSafely(event: DomainEvent): Promise<void> {
  const { registerEventConsumers } = await import('./consumers');
  await registerEventConsumers(event);
}

export async function enqueueDeadLetter(
  event: DomainEvent,
  error: unknown,
  reason = 'unknown'
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const attempts = 1;
  const nextRetryAt = new Date(Date.now() + backoffMs(attempts));

  try {
    await prisma.failedEvent.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        eventType: event.type,
        payload: event as object,
        errorMessage: `[${reason}] ${message}`.slice(0, 4000),
        errorStack: stack,
        attempts,
        nextRetryAt,
      },
      update: {
        eventType: event.type,
        payload: event as object,
        errorMessage: `[${reason}] ${message}`.slice(0, 4000),
        errorStack: stack,
        attempts: { increment: 1 },
        nextRetryAt,
        resolvedAt: null,
      },
    });
    appLog('error', 'domain_event_dlq_enqueued', {
      eventId: event.id,
      type: event.type,
      reason,
    });
  } catch (e) {
    appLog('error', 'dlq_persist_failed', {
      eventId: event.id,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

function backoffMs(attempts: number): number {
  return Math.min(3_600_000, 60_000 * Math.pow(2, Math.max(0, attempts - 1)));
}

export async function retryFailedEvents(limit = 25): Promise<number> {
  const due = await prisma.failedEvent.findMany({
    where: {
      resolvedAt: null,
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_DLQ_ATTEMPTS },
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  let retried = 0;
  for (const row of due) {
    const event = row.payload as unknown as DomainEvent;
    try {
      await runConsumersSafely(event);
      await prisma.failedEvent.update({
        where: { id: row.id },
        data: { resolvedAt: new Date(), attempts: row.attempts + 1 },
      });
      retried += 1;
    } catch (err) {
      const nextAttempts = row.attempts + 1;
      await prisma.failedEvent.update({
        where: { id: row.id },
        data: {
          attempts: nextAttempts,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          nextRetryAt: new Date(Date.now() + backoffMs(nextAttempts)),
          resolvedAt: nextAttempts >= MAX_DLQ_ATTEMPTS ? new Date() : null,
        },
      });
      if (nextAttempts >= MAX_DLQ_ATTEMPTS) {
        appLog('error', 'domain_event_dlq_abandoned', { eventId: row.eventId, attempts: nextAttempts });
      }
    }
  }
  return retried;
}
