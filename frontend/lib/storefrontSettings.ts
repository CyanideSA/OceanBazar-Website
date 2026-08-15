import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';

export const STOREFRONT_SETTINGS_QUERY_KEY = ['storefront-settings'] as const;

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Merge storefront settings without letting empty/partial cache entries
 * (e.g. hero-only seeds) wipe CRM contact/social fields.
 */
export function coalesceStorefrontSettings(
  ...sources: Array<StorefrontPublicSettings | null | undefined>
): StorefrontPublicSettings {
  const out: Record<string, unknown> = {};
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const [key, value] of Object.entries(src)) {
      if (isBlank(value)) continue;
      // Prefer the first non-blank value in source order.
      if (isBlank(out[key])) out[key] = value;
    }
  }
  return out as StorefrontPublicSettings;
}
