/**
 * Page content overrides from Admin > Global Settings (`site_settings.page_content`).
 * Storefront pages deep-merge overrides over code/i18n defaults so partial edits are safe.
 */

export type PageLocale = 'en' | 'bn';

export type PageContentBlob = {
  policies?: Record<string, Partial<Record<PageLocale, unknown>>>;
  support?: Partial<Record<PageLocale, Record<string, string>>>;
  marketing?: Partial<Record<PageLocale, Record<string, string>>>;
  wholesale?: Partial<Record<PageLocale, Record<string, string>>>;
  obPoints?: Partial<Record<PageLocale, Record<string, string>>>;
  businessInquiries?: Partial<Record<PageLocale, Record<string, string>>>;
  [key: string]: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge override onto defaults. Arrays in override replace entirely. Empty strings in override are ignored (keep default). */
export function deepMerge<T>(defaults: T, override: unknown): T {
  if (override == null) return defaults;
  if (Array.isArray(defaults)) {
    return (Array.isArray(override) ? override : defaults) as T;
  }
  if (!isPlainObject(defaults)) {
    if (typeof override === 'string' && override.trim() === '') return defaults;
    return (override !== undefined && override !== null ? override : defaults) as T;
  }
  if (!isPlainObject(override)) return defaults;

  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    const base = (defaults as Record<string, unknown>)[k];
    out[k] = deepMerge(base, v);
  }
  return out as T;
}

export function normalizePageLocale(locale: string): PageLocale {
  return locale === 'bn' ? 'bn' : 'en';
}

/** Flat message override for support / marketing / wholesale / obPoints / businessInquiries. */
export function getMessageOverrides(
  pageContent: PageContentBlob | null | undefined,
  page: 'support' | 'marketing' | 'wholesale' | 'obPoints' | 'businessInquiries',
  locale: string
): Record<string, string> {
  const loc = normalizePageLocale(locale);
  const raw = pageContent?.[page];
  if (!isPlainObject(raw)) return {};
  const forLocale = raw[loc];
  if (!isPlainObject(forLocale)) return {};
  const out: Record<string, string> = {};
  const walk = (obj: Record<string, unknown>, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string' && v.trim()) out[key] = v;
      else if (isPlainObject(v)) walk(v, key);
    }
  };
  walk(forLocale);
  return out;
}

/** Helper: prefer override string, else translation. */
export function tx(
  overrides: Record<string, string> | undefined | null,
  key: string,
  fallback: string
): string {
  const v = overrides?.[key];
  if (typeof v === 'string' && v.trim()) return v;
  return fallback;
}
