import type { DomainEvent } from '../domain-events';

export async function handleCourierSyncEvent(event: DomainEvent): Promise<void> {
  if (event.type !== 'ShipmentCreated') return;
  // Courier booking is triggered from delivery routes; hook for async Pathao/Steadfast sync.
}
