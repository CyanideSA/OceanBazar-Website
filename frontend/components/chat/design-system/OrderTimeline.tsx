'use client';

export interface OrderTimelineData {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  trackingNumber?: string;
  timeline: Array<{ label: string; done: boolean; at?: string }>;
}

export function OrderTimeline({ order }: { order: OrderTimelineData }) {
  return (
    <div className="mt-2 rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm">
      <p className="text-xs font-bold text-foreground">{order.orderNumber}</p>
      <p className="text-[11px] text-muted-foreground">Status: {order.status} · ৳{order.total.toLocaleString()}</p>
      {order.trackingNumber && (
        <p className="mt-1 text-[10px] font-mono text-primary">Tracking: {order.trackingNumber}</p>
      )}
      <div className="mt-2 space-y-1">
        {order.timeline.map((step) => (
          <div key={step.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
            <span className={`text-[10px] ${step.done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
