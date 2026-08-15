import type { DomainEvent } from '../domain-events';
import { emitToUser } from '../../lib/adminEvents';
import { appLog } from '../../lib/appLog';

export async function handleNotificationEvent(event: DomainEvent): Promise<void> {
  const userId = event.userId ?? (event.payload.userId as string | undefined);
  if (!userId) return;

  switch (event.type) {
    case 'OrderPlaced':
      emitToUser(userId, 'notification:new', {
        title: 'Order placed',
        message: `Order ${event.aggregateId ?? ''} received`,
        kind: 'order',
        entityId: event.aggregateId,
      });
      break;
    case 'PaymentConfirmed':
      emitToUser(userId, 'notification:new', {
        title: 'Payment confirmed',
        message: 'Your payment was successful',
        kind: 'payment',
        entityId: event.aggregateId,
      });
      break;
    case 'ShipmentCreated':
      emitToUser(userId, 'notification:new', {
        title: 'Shipment update',
        message: 'Your order is on the way',
        kind: 'shipment',
        entityId: event.aggregateId,
      });
      break;
    case 'TicketCreated':
      emitToUser(userId, 'ticket:updated', { ticketId: event.aggregateId, event: 'created' });
      break;
    default:
      break;
  }
  appLog('info', 'notification_consumer_handled', { type: event.type, userId });
}
