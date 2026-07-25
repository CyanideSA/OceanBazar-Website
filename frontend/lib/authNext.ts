/**
 * Safe post-auth redirect from `?next=` — only same-origin relative paths.
 */
export function resolveAuthNextPath(locale: string, search?: string): string {
  const fallback = `/${locale}`;
  try {
    const q = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    const next = new URLSearchParams(q).get('next');
    if (!next) return fallback;
    if (!next.startsWith('/') || next.startsWith('//')) return fallback;
    if (next.includes('://')) return fallback;
    return next;
  } catch {
    return fallback;
  }
}
