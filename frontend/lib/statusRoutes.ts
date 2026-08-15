/**
 * Central paths for user-facing status pages (use with router.push / redirects).
 * Keep in sync with app/[locale]/(status) routes.
 */
export function maintenancePath(locale: string) {
  return `/${locale}/maintenance`;
}

export function somethingWentWrongPath(locale: string, query?: { code?: string }) {
  const base = `/${locale}/something-went-wrong`;
  if (!query?.code) return base;
  const q = new URLSearchParams({ code: query.code });
  return `${base}?${q.toString()}`;
}
