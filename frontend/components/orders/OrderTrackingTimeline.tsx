'use client';

import { useId, useMemo, useState } from 'react';
import {
  Waves, Package, Ship, Truck, CheckCircle2,
  Anchor, ChevronDown, ChevronUp, Clock, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const TRACKING_STEP_LABELS = [
  'Order Placed',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
] as const;

export function getFulfillmentTimelineIndex(status: string | undefined | null): number {
  const s = String(status ?? '').toLowerCase();
  if (s === 'cancelled' || s === 'refunded') return -1;
  if (s === 'delivered') return 4;
  if (s === 'out_for_delivery' || s === 'in_transit') return 3;
  if (s === 'shipped') return 2;
  if (s === 'processing' || s === 'confirmed') return 1;
  return 0;
}

function formatStepTime(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const WAVE_D = 'M0,34 C166,8 334,60 500,34 C666,8 834,60 1000,34';

const STEP_ICONS = [Waves, Package, Ship, Truck, CheckCircle2] as const;

/* Mobile step component */
function MobileStep({
  Icon,
  label,
  active,
  current,
  cancelled,
  isLast,
  occurredAt,
  detail,
}: {
  Icon: React.ElementType;
  label: string;
  active: boolean;
  current: boolean;
  cancelled: boolean;
  isLast: boolean;
  occurredAt?: string | number | null;
  detail?: string | null;
}) {
  const timeStr = formatStepTime(occurredAt);
  return (
    <div className="relative flex gap-3">
      {/* Vertical wave line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 overflow-hidden">
          <div className={cn(
            'w-full h-full',
            active && !cancelled ? 'bg-primary/40' : 'bg-border'
          )}>
            {active && !cancelled && (
              <div className="w-full h-full bg-gradient-to-b from-primary via-primary to-transparent animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Icon node */}
      <div
        className={cn(
          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          current && !cancelled
            ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : active && !cancelled
              ? 'border-primary/60 bg-card text-primary'
              : 'border-border bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
        {current && !cancelled && (
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <p
          className={cn(
            'font-semibold',
            current && !cancelled
              ? 'text-primary'
              : active && !cancelled
                ? 'text-foreground'
                : 'text-muted-foreground'
          )}
        >
          {label}
        </p>
        {timeStr ? (
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeStr}
          </p>
        ) : null}
        {detail && (
          <p className="mt-1 text-xs text-primary/80">{detail}</p>
        )}
        {current && !cancelled && !detail && (
          <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            In progress
          </span>
        )}
      </div>
    </div>
  );
}

type StepNodeProps = {
  label: string;
  Icon: React.ElementType;
  active: boolean;
  current: boolean;
  cancelled: boolean;
  occurredAt?: string | number | null;
  detail?: string | null;
};

function StepNode({ label, Icon, active, current, cancelled, occurredAt, detail }: StepNodeProps) {
  const timeStr = formatStepTime(occurredAt);
  return (
    <div
      className={cn(
        'flex flex-col items-center min-w-[4.5rem] sm:min-w-0 text-center transition-all duration-500 ease-out',
        active && !cancelled ? 'opacity-100' : 'opacity-40',
        cancelled && 'opacity-35'
      )}
    >
      <div
        className={cn(
          'relative mb-1.5 flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-500 ease-out',
          current && !cancelled
            ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105'
            : active && !cancelled
              ? 'border-primary/60 bg-card text-primary shadow-sm'
              : 'border-border bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} aria-hidden />
        {current && !cancelled && (
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background animate-pulse motion-reduce:animate-none" />
        )}
      </div>
      <span
        className={cn(
          'text-[10px] sm:text-[11px] font-semibold leading-tight max-w-[6rem] transition-colors duration-500',
          current && !cancelled
            ? 'text-primary'
            : active && !cancelled
              ? 'text-foreground'
              : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
      {timeStr ? (
        <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground font-medium tabular-nums">
          <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" aria-hidden />
          {timeStr}
        </span>
      ) : active && !cancelled ? (
        <span className="mt-1 text-[9px] text-muted-foreground/60">—</span>
      ) : (
        <span className="mt-1 h-3" aria-hidden />
      )}
      {detail && (
        <span className="mt-0.5 text-[9px] text-primary/80 max-w-[6.5rem] leading-snug line-clamp-2">
          {detail}
        </span>
      )}
    </div>
  );
}

export type TrackingStep = {
  key?: string;
  label?: string;
  completed?: boolean;
  current?: boolean;
  occurredAt?: string | number | null;
  detail?: string | null;
};

export type TrackingEvent = {
  at?: string | number | null;
  type?: string;
  message?: string;
  status?: string;
};

export type TrackingData = {
  cancelled?: boolean;
  currentStepIndex?: number;
  steps?: TrackingStep[];
  events?: TrackingEvent[];
  estimatedDelivery?: string | null;
};

type Props = {
  status?: string | null;
  className?: string;
  tracking?: TrackingData | null;
  estimatedDelivery?: string | null;
};

export function OrderTrackingTimeline({ status, className, tracking, estimatedDelivery }: Props) {
  const uid = useId().replace(/:/g, '');
  const gradProgress = `trackingWaveProgress-${uid}`;
  const gradSheen = `trackingWaterSheen-${uid}`;

  const fromApi =
    tracking?.steps != null &&
    Array.isArray(tracking.steps) &&
    tracking.steps.length === TRACKING_STEP_LABELS.length;

  const stageIndex = useMemo(() => {
    if (tracking && typeof tracking.currentStepIndex === 'number') return tracking.currentStepIndex;
    return getFulfillmentTimelineIndex(status);
  }, [tracking, status]);

  const cancelled = useMemo(() => {
    if (tracking && typeof tracking.cancelled === 'boolean') return tracking.cancelled;
    return stageIndex === -1;
  }, [tracking, stageIndex]);

  const effective = cancelled ? 0 : Math.max(0, Math.min(4, stageIndex));
  const progressPct = cancelled ? 0 : (effective / (TRACKING_STEP_LABELS.length - 1)) * 100;
  const dashOffset = 100 - progressPct;

  const labels = useMemo<readonly string[]>(() => {
    if (!fromApi || !tracking?.steps) return TRACKING_STEP_LABELS;
    return tracking.steps.map((s, i) => s?.label ?? TRACKING_STEP_LABELS[i]);
  }, [fromApi, tracking]);

  const [logOpen, setLogOpen] = useState(false);
  const events: TrackingEvent[] =
    tracking?.events && Array.isArray(tracking.events) ? tracking.events : [];

  const estDelivery = tracking?.estimatedDelivery ?? estimatedDelivery ?? null;
  let estDisplay: string | null = null;
  if (estDelivery) {
    const d = new Date(estDelivery);
    if (!Number.isNaN(d.getTime())) {
      estDisplay = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card overflow-hidden',
        'shadow-soft p-4 sm:p-6',
        className
      )}
      aria-label="Order shipment tracking"
    >
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-bold tracking-widest text-primary uppercase">
            Track Shipment
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {cancelled
              ? 'This order was cancelled.'
              : `Current: ${labels[effective] ?? TRACKING_STEP_LABELS[effective]}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {estDisplay && !cancelled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border sm:px-3 sm:py-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              Est. {estDisplay}
            </span>
          )}
          {cancelled ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive border border-destructive/20 sm:px-3 sm:py-1.5">
              <Anchor className="h-3 w-3 shrink-0" aria-hidden />
              Cancelled
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20 sm:px-3 sm:py-1.5">
              <Ship className="h-3 w-3 shrink-0" aria-hidden />
              Live updates
            </div>
          )}
        </div>
      </div>

      {/* Wave SVG - desktop only */}
      <div className="relative mx-auto mb-7 hidden w-full max-w-4xl px-1 sm:block sm:px-2">
        <svg
          viewBox="0 0 1000 56"
          className="block h-16 w-full sm:h-[4.75rem] select-none"
          preserveAspectRatio="none"
          role="presentation"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradProgress} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="60%" stopColor="hsl(var(--primary) / 0.85)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.7)" />
            </linearGradient>
            <linearGradient id={gradSheen} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Water fill sheen */}
          <path
            d="M0,56 V38 Q250,48 500,38 T1000,38 V56 Z"
            fill={`url(#${gradSheen})`}
          />

          {/* Track (grey) */}
          <path
            d={WAVE_D}
            pathLength="100"
            fill="none"
            className="text-border"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
          />

          {/* Animated dashes */}
          <path
            d={WAVE_D}
            pathLength="100"
            fill="none"
            stroke="currentColor"
            className="text-primary/30 motion-safe:animate-tracking-wave-flow motion-reduce:animate-none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="5 11"
          />

          {/* Progress fill */}
          <path
            d={WAVE_D}
            pathLength="100"
            fill="none"
            stroke={`url(#${gradProgress})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.33,1,0.68,1)' }}
          />
        </svg>

        {/* Boat icon travelling along wave */}
        <div
          className={cn(
            'pointer-events-none absolute left-0 right-0 top-[30%] -translate-y-1/2 h-10 px-[5%] sm:px-[4%]',
            cancelled && 'opacity-40'
          )}
        >
          <div
            className={cn(
              'absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
              'ring-2 ring-background',
              'motion-safe:animate-tracking-boat-bob motion-reduce:animate-none',
              'transition-[left] duration-[900ms] ease-[cubic-bezier(0.33,1,0.68,1)]'
            )}
            style={{ left: `${10 + (Math.max(effective, 0) / (TRACKING_STEP_LABELS.length - 1)) * 80}%` }}
            aria-hidden
          >
            <Ship className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* Mobile: Vertical stacked timeline */}
      <div className="sm:hidden">
        <div className="relative pl-1">
          {TRACKING_STEP_LABELS.map((defaultLabel, i) => {
            const Icon = STEP_ICONS[i];
            const apiStep = fromApi && tracking?.steps ? tracking.steps[i] : null;
            const label = apiStep?.label ?? defaultLabel;
            const active = fromApi
              ? Boolean(apiStep?.completed)
              : !cancelled && i <= effective;
            const current = fromApi
              ? Boolean(apiStep?.current)
              : !cancelled && i === effective;
            return (
              <MobileStep
                key={defaultLabel}
                Icon={Icon}
                label={label}
                active={active}
                current={current}
                cancelled={cancelled}
                isLast={i === TRACKING_STEP_LABELS.length - 1}
                occurredAt={apiStep?.occurredAt}
                detail={apiStep?.detail}
              />
            );
          })}
        </div>
      </div>

      {/* Desktop: Horizontal wave timeline */}
      <div className="hidden sm:block relative pt-1">
        <div className="grid grid-cols-5 gap-2 w-full">
          {TRACKING_STEP_LABELS.map((defaultLabel, i) => {
            const Icon = STEP_ICONS[i];
            const apiStep = fromApi && tracking?.steps ? tracking.steps[i] : null;
            const label = apiStep?.label ?? defaultLabel;
            const active = fromApi
              ? Boolean(apiStep?.completed)
              : !cancelled && i <= effective;
            const current = fromApi
              ? Boolean(apiStep?.current)
              : !cancelled && i === effective;
            return (
              <StepNode
                key={defaultLabel}
                label={label}
                Icon={Icon}
                active={active}
                current={current}
                cancelled={cancelled}
                occurredAt={apiStep?.occurredAt}
                detail={apiStep?.detail}
              />
            );
          })}
        </div>
      </div>

      {/* Shipment event log */}
      {events.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border">
          <button
            type="button"
            onClick={() => setLogOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 text-left rounded-xl px-3 py-2 -mx-1 hover:bg-muted/60 transition-colors"
          >
            <span className="text-sm font-semibold text-foreground">
              Shipment activity ({events.length})
            </span>
            {logOpen
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {logOpen && (
            <ul className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1 text-sm">
              {[...events].reverse().map((ev, idx) => (
                <li
                  key={`${ev.at}-${idx}`}
                  className="flex gap-3 rounded-lg bg-muted/40 border border-border px-3 py-2"
                >
                  <span className="shrink-0 text-[11px] font-medium text-primary tabular-nums w-28 sm:w-auto">
                    {formatStepTime(ev.at) ?? '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground leading-snug">{ev.message ?? ev.type ?? 'Update'}</p>
                    {ev.status && (
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        Status: {ev.status.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderTrackingTimeline;
