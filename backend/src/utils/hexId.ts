import { randomBytes } from 'crypto';

/**
 * Generates an 8-character uppercase HEX ID for entities
 * (users, products, orders, categories, variants, tickets, etc.)
 * Example: "A3F2B1C9"
 */
export function generateEntityId(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Generates a 16-character uppercase HEX tracking number
 * (shipments, delivery tracking)
 * Example: "A3F2B1C9D4E5F6A7"
 */
export function generateTrackingNumber(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Formats an order ID for human-readable display
 * Example: "A3F2B1C9" → "OB-A3F2B1C9"
 */
export function formatOrderNumber(id: string): string {
  return `OB-${id.toUpperCase()}`;
}

/**
 * Validates a value is a valid 8-char HEX entity ID
 */
export function isValidEntityId(id: string): boolean {
  return /^[0-9A-Fa-f]{8}$/.test(id);
}

/**
 * Generates a URL-friendly slug from a string.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
