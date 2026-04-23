'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStudio } from '@/lib/adminApi';

const STATUSES = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned'] as const;

export default function AdminDeliveryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-shipments'],
    queryFn: () => adminStudio.shipments().then((r) => r.data.shipments),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminStudio.updateShipment(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shipments'] }),
  });

  const shipments = data ?? [];

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Delivery & tracking</h1>
      <p className="text-sm text-muted-foreground">Assign carriers when creating shipments from the API / admin tools. Update parcel status here.</p>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {shipments.map(
            (s: {
              id: string;
              carrier: string;
              trackingNumber: string;
              status: string;
              estimatedDelivery: string | null;
              order: { orderNumber: string; user?: { name?: string } };
            }) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-mono text-sm font-semibold">{s.trackingNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.carrier} · Order {s.order.orderNumber} · {s.order.user?.name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ETA: {s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : '—'}
                  </p>
                </div>
                <select
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  value={s.status}
                  onChange={(e) => updateMut.mutate({ id: s.id, status: e.target.value })}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
