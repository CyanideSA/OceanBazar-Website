/** Normalize Express route param (typed as `string | string[]`) to `string`. */
export function routeParam(raw: string | string[] | undefined): string {
  if (raw === undefined) return '';
  return Array.isArray(raw) ? raw[0] ?? '' : raw;
}
