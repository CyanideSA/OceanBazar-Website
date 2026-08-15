import { prisma } from '../../lib/prisma';

import type { DomainEvent } from '../domain-events';


export async function handleAnalyticsEvent(event: DomainEvent): Promise<void> {
  if (event.type === 'OrderPlaced' && event.aggregateId) {
    const total = Number(event.payload.total ?? 0);
    await prisma.$executeRaw`
      INSERT INTO analytics.event_log (event_type, aggregate_id, user_id, payload, occurred_at)
      VALUES (${event.type}, ${event.aggregateId}, ${event.userId ?? null}, ${JSON.stringify(event.payload)}::jsonb, ${event.occurredAt}::timestamptz)
      ON CONFLICT DO NOTHING
    `.catch(() => {
      /* analytics schema may not exist yet in dev */
    });
    if (total > 0) {
      await prisma.$executeRaw`
        INSERT INTO analytics.sales_daily (day, order_count, revenue)
        VALUES (CURRENT_DATE, 1, ${total})
        ON CONFLICT (day) DO UPDATE SET
          order_count = analytics.sales_daily.order_count + 1,
          revenue = analytics.sales_daily.revenue + EXCLUDED.revenue
      `.catch(() => {});
    }
  }
}
