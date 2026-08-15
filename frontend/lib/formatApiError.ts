/** Coerce API / toast payloads into a safe React child string. */
export function formatApiErrorMessage(value: unknown, fallback = 'Something went wrong'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const s = value.trim();
    return s || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
    if (o.error && typeof o.error === 'object') {
      const nested = o.error as Record<string, unknown>;
      if (typeof nested.message === 'string' && nested.message.trim()) return nested.message.trim();
    }
    if (typeof o.detail === 'string' && o.detail.trim()) return o.detail.trim();
  }
  return fallback;
}
