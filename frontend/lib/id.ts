import { randomBytes } from 'crypto';

export function generateEntityId(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

export function generateTrackingNumber(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

export function formatOrderNumber(id: string): string {
  return `OB-${id.toUpperCase()}`;
}
