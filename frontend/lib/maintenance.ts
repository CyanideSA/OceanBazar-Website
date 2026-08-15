/**
 * Storefront maintenance gate (Edge middleware).
 * Enable: MAINTENANCE_MODE=true in .env.local / production env.
 */

export const MAINTENANCE_BYPASS_COOKIE = 'ob_maint_bypass';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isMaintenanceModeEnabled(): boolean {
  const v = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return v !== undefined && TRUTHY.has(v);
}

export function getMaintenanceBypassToken(): string | undefined {
  const t = process.env.MAINTENANCE_BYPASS_TOKEN?.trim();
  return t || undefined;
}

export function maintenanceRetryAfterSeconds(): string {
  return process.env.MAINTENANCE_RETRY_AFTER?.trim() || '3600';
}

export function maintenanceCookieDomain(): string | undefined {
  const d = process.env.MAINTENANCE_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

export function maintenanceCookieDomainForRequest(host: string | null): string | undefined {
  const configured = maintenanceCookieDomain();
  if (!configured) return undefined;
  const h = (host ?? '').split(':')[0].toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')) {
    return undefined;
  }
  return configured;
}
