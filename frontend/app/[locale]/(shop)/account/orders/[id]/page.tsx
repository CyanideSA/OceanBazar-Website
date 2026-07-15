import { Suspense } from 'react';
import OrderDetailClient from '@/components/orders/OrderDetailClient';
import { staticExportPlaceholderIdParams } from '@/lib/staticExportDummyParams';

export async function generateStaticParams() {
  return staticExportPlaceholderIdParams();
}

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function AccountOrderDetailPage(props: Props) {
  const params = await props.params;
  return (
    <Suspense fallback={<OrderDetailFallback />}>
      <OrderDetailClient orderId={params.id} />
    </Suspense>
  );
}

function OrderDetailFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
