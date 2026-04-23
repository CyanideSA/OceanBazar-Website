import { Suspense } from 'react';
import OrderDetailClient from '@/components/orders/OrderDetailClient';

interface Props {
  params: { id: string; locale: string };
}

export default function OrderPage({ params }: Props) {
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
