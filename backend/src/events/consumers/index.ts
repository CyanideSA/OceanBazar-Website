import type { DomainEvent } from '../domain-events';
import { handleAnalyticsEvent } from './analyticsConsumer';
import { handleNotificationEvent } from './notificationConsumer';
import { handleObPointsEvent } from './obPointsConsumer';
import { handleCourierSyncEvent } from './courierSyncConsumer';

const HANDLERS: Array<(e: DomainEvent) => Promise<void>> = [
  handleNotificationEvent,
  handleAnalyticsEvent,
  handleObPointsEvent,
  handleCourierSyncEvent,
];

export async function registerEventConsumers(event: DomainEvent): Promise<void> {
  for (const handler of HANDLERS) {
    await handler(event);
  }
}
