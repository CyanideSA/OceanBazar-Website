import { Suspense } from 'react';
import FlashDealsPageClient from '@/components/flash-sale/FlashDealsPageClient';
import { fetchFlashDealsPage } from '@/lib/fetchStorefrontCatalog';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export default async function FlashDealsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const sale = first(sp.sale).trim() || null;
  const initialPayload = await fetchFlashDealsPage(locale, sale);


  return (
    <Suspense fallback={<div className="section-padding container-tight min-h-[50vh] animate-pulse rounded-2xl bg-muted/30" />}>
      <FlashDealsPageClient initialPayload={initialPayload} />
    </Suspense>
  );
}
