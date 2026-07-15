import { Suspense } from 'react';
import FlashDealsPageClient from '@/components/flash-sale/FlashDealsPageClient';

export default function FlashDealsPage() {
  return (
    <Suspense fallback={<div className="section-padding container-tight min-h-[50vh] animate-pulse rounded-2xl bg-muted/30" />}>
      <FlashDealsPageClient />
    </Suspense>
  );
}
