import type { DomainEvent } from '../domain-events';

/** OB points side-effects run after payment confirmation (ledger writes stay in order flow). */
export async function handleObPointsEvent(event: DomainEvent): Promise<void> {
  if (event.type !== 'PaymentConfirmed' && event.type !== 'OrderPlaced') return;
  // Points accrual is invoked from orders route; consumer reserved for async grants.
}
