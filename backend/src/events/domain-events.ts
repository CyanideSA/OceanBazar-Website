export type DomainEventType =
  | 'OrderPlaced'
  | 'PaymentConfirmed'
  | 'ShipmentCreated'
  | 'ProductImported'
  | 'UserRegistered'
  | 'PointsGranted'
  | 'TicketCreated'
  | 'CatalogChanged';

export interface DomainEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  occurredAt: string;
  aggregateId?: string;
  userId?: string;
  payload: T;
}

export function createDomainEvent<T extends Record<string, unknown>>(
  type: DomainEventType,
  payload: T,
  meta?: { aggregateId?: string; userId?: string }
): DomainEvent<T> {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type,
    occurredAt: new Date().toISOString(),
    aggregateId: meta?.aggregateId,
    userId: meta?.userId,
    payload,
  };
}
