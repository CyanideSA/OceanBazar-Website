/** Placeholder dynamic segment for `output: export`. Next.js treats empty `generateStaticParams()` as invalid export config. */
export const STATIC_EXPORT_PLACEHOLDER_ID = '__static_export__';

export function staticExportPlaceholderIdParams(): { id: string }[] {
  if (process.env.NEXT_STATIC_EXPORT !== '1') return [];
  return [{ id: STATIC_EXPORT_PLACEHOLDER_ID }];
}
