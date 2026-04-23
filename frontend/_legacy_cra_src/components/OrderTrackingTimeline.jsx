import React, { useId, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import {
  Waves,
  Package,
  Ship,
  Truck,
  CheckCircle2,
  Anchor,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

/** Canonical labels (aligned with backend / Amazon-style flow). */
export const TRACKING_STEP_LABELS = [
  'Order Placed',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

/**
 * @param {string | undefined} status Order status wire value
 * @returns {number} 0–4 active step, or -1 cancelled
 */
export function getFulfillmentTimelineIndex(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled' || s === 'refunded') return -1;
  if (s === 'delivered') return 4;
  if (s === 'in_transit' || s === 'out_for_delivery') return 3;
  if (s === 'shipped') return 2;
  if (s === 'processing' || s === 'confirmed') return 1;
  return 0;
}

function formatStepTime(value) {
  if (value == null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const WAVE_D =
  'M0,34 C166,8 334,60 500,34 C666,8 834,60 1000,34';

const STEP_ICONS = [Waves, Package, Ship, Truck, CheckCircle2];

function StepNode({ label, Icon, active, current, cancelled, occurredAt, detail }) {
  const timeStr = formatStepTime(occurredAt);
  return (
    <div
      className={cn(
        'flex flex-col items-center min-w-[4.5rem] sm:min-w-0 text-center transition-all duration-500 ease-out',
        active && !cancelled && 'opacity-100',
        !active && !cancelled && 'opacity-40',
        cancelled && 'opacity-35'
      )}
    >
      <div
        className={cn(
          'relative mb-1.5 flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-500 ease-out',
          current && !cancelled
            ? 'border-[#5BA3D0] bg-[#5BA3D0] text-white shadow-lg shadow-[#5BA3D0]/30 scale-105'
            : active && !cancelled
              ? 'border-[#5BA3D0]/85 bg-white dark:bg-gray-800 text-[#5BA3D0] shadow-sm'
              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 text-gray-400'
        )}
      >
        <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} aria-hidden />
        {current && !cancelled ? (
          <span className="absolute inset-0 rounded-full ring-2 ring-[#5BA3D0]/35 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 animate-pulse motion-reduce:animate-none" />
        ) : null}
      </div>
      <span
        className={cn(
          'text-[10px] sm:text-[11px] font-semibold leading-tight max-w-[6rem] transition-colors duration-500',
          current && !cancelled
            ? 'text-[#1e4d6b] dark:text-[#7BB8DC]'
            : active && !cancelled
              ? 'text-gray-800 dark:text-gray-200'
              : 'text-gray-500 dark:text-gray-500'
        )}
      >
        {label}
      </span>
      {timeStr ? (
        <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 font-medium tabular-nums">
          <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" aria-hidden />
          {timeStr}
        </span>
      ) : active && !cancelled ? (
        <span className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">—</span>
      ) : (
        <span className="mt-1 h-3" aria-hidden />
      )}
      {detail ? (
        <span className="mt-0.5 text-[9px] text-[#4A90B8] dark:text-[#7BB8DC]/90 max-w-[6.5rem] leading-snug line-clamp-2">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   status?: string,
 *   className?: string,
 *   tracking?: {
 *     cancelled?: boolean,
 *     currentStepIndex?: number,
 *     steps?: Array<{
 *       key?: string,
 *       label?: string,
 *       completed?: boolean,
 *       current?: boolean,
 *       occurredAt?: string | number,
 *       detail?: string,
 *     }>,
 *     events?: Array<{ at?: string | number, type?: string, message?: string, status?: string }>,
 *   } | null,
 * }} props
 */
export function OrderTrackingTimeline({ status, className, tracking }) {
  const uid = useId().replace(/:/g, '');
  const gradProgress = `trackingWaveProgress-${uid}`;
  const gradSheen = `trackingWaterSheen-${uid}`;

  const fromApi = tracking?.steps && Array.isArray(tracking.steps) && tracking.steps.length === TRACKING_STEP_LABELS.length;

  const stageIndex = useMemo(() => {
    if (tracking && typeof tracking.currentStepIndex === 'number') {
      return tracking.currentStepIndex;
    }
    return getFulfillmentTimelineIndex(status);
  }, [tracking, status]);

  const cancelled = useMemo(() => {
    if (tracking && typeof tracking.cancelled === 'boolean') return tracking.cancelled;
    return stageIndex === -1;
  }, [tracking, stageIndex]);

  const effective = cancelled ? 0 : Math.max(0, Math.min(4, stageIndex));
  const progressPct = cancelled ? 0 : (effective / (TRACKING_STEP_LABELS.length - 1)) * 100;
  const dashOffset = 100 - progressPct;

  const labels = useMemo(() => {
    if (!fromApi) return TRACKING_STEP_LABELS;
    return tracking.steps.map((s, i) => s?.label || TRACKING_STEP_LABELS[i]);
  }, [fromApi, tracking]);

  const [logOpen, setLogOpen] = useState(false);
  const events = tracking?.events && Array.isArray(tracking.events) ? tracking.events : [];

  return (
    <div
      className={cn(
        'rounded-2xl border border-[#cfe8f6]/90 dark:border-gray-700/90',
        'bg-gradient-to-br from-white via-[#f5fafd] to-white dark:from-gray-900/95 dark:via-gray-900/80 dark:to-gray-900/90',
        'shadow-[0_8px_30px_rgb(91,163,208,0.08)] dark:shadow-none p-5 sm:p-7 overflow-hidden',
        className
      )}
      aria-label="Order shipment tracking"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold tracking-[0.12em] text-[#2E6A94] dark:text-[#7BB8DC] uppercase">
            Track shipment
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {cancelled
              ? 'This order was cancelled.'
              : `Now: ${labels[effective] || TRACKING_STEP_LABELS[effective]}`}
          </p>
        </div>
        {cancelled ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-900/50">
            <Anchor className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Cancelled
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#5BA3D0]/10 dark:bg-[#5BA3D0]/15 px-3 py-1.5 text-xs font-semibold text-[#2E6A94] dark:text-[#7BB8DC] border border-[#5BA3D0]/25">
            <Ship className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Live updates
          </div>
        )}
      </div>

      <div className="relative mx-auto mb-7 w-full max-w-4xl px-1 sm:px-2">
        <svg
          viewBox="0 0 1000 56"
          className="block h-16 w-full sm:h-[4.75rem] select-none"
          preserveAspectRatio="none"
          role="presentation"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradProgress} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5BA3D0" />
              <stop offset="55%" stopColor="#6DADE0" />
              <stop offset="100%" stopColor="#3d7ba8" />
            </linearGradient>
            <linearGradient id={gradSheen} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5BA3D0" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#5BA3D0" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d="M0,56 V38 Q250,48 500,38 T1000,38 V56 Z"
            fill={`url(#${gradSheen})`}
            className="transition-opacity duration-500"
          />

          <path
            d={WAVE_D}
            pathLength="100"
            fill="none"
            className="text-gray-200 dark:text-gray-600"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
          />

          <path
            d={WAVE_D}
            pathLength="100"
            fill="none"
            stroke="currentColor"
            className="text-[#5BA3D0]/40 dark:text-[#7BB8DC]/40 motion-safe:animate-tracking-wave-flow motion-reduce:animate-none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="5 11"
          />

          <path
            d={WAVE_D}
            pathLength="100"
            fill="none"
            stroke={`url(#${gradProgress})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 0.9s cubic-bezier(0.33, 1, 0.68, 1)',
            }}
          />
        </svg>

        <div
          className={cn(
            'pointer-events-none absolute left-0 right-0 top-[30%] -translate-y-1/2 h-10 px-[5%] sm:px-[4%]',
            cancelled && 'opacity-40'
          )}
        >
          <div
            className={cn(
              'absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
              'bg-gradient-to-br from-[#4A90B8] to-[#5BA3D0] text-white shadow-lg shadow-[#5BA3D0]/35',
              'ring-2 ring-white/90 dark:ring-gray-900/90',
              'motion-safe:animate-tracking-boat-bob motion-reduce:animate-none',
              'transition-[left] duration-[900ms] ease-[cubic-bezier(0.33,1,0.68,1)]'
            )}
            style={{
              left: `${10 + (Math.max(effective, 0) / (TRACKING_STEP_LABELS.length - 1)) * 80}%`,
            }}
            aria-hidden
          >
            <Ship className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
          </div>
        </div>
      </div>

      <div className="relative pt-1">
        <div className="grid grid-cols-5 gap-1 sm:gap-2 w-full">
          {TRACKING_STEP_LABELS.map((defaultLabel, i) => {
            const Icon = STEP_ICONS[i];
            const apiStep = fromApi ? tracking.steps[i] : null;
            const label = apiStep?.label || defaultLabel;
            const active = fromApi ? Boolean(apiStep?.completed) : !cancelled && i <= effective;
            const current = fromApi ? Boolean(apiStep?.current) : !cancelled && i === effective;
            const occurredAt = apiStep?.occurredAt;
            const detail = apiStep?.detail;

            return (
              <StepNode
                key={defaultLabel}
                label={label}
                Icon={Icon}
                active={active}
                current={current}
                cancelled={cancelled}
                occurredAt={occurredAt}
                detail={detail}
              />
            );
          })}
        </div>
      </div>

      {events.length > 0 ? (
        <div className="mt-6 pt-5 border-t border-[#dceef8] dark:border-gray-700/80">
          <button
            type="button"
            onClick={() => setLogOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 text-left rounded-xl px-3 py-2 -mx-1 hover:bg-[#5BA3D0]/6 dark:hover:bg-gray-800/60 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Shipment activity ({events.length})
            </span>
            {logOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {logOpen ? (
            <ul className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1 text-sm">
              {[...events]
                .slice()
                .reverse()
                .map((ev, idx) => (
                  <li
                    key={`${ev.at}-${idx}`}
                    className="flex gap-3 rounded-lg bg-white/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/80 px-3 py-2"
                  >
                    <span className="shrink-0 text-[11px] font-medium text-[#5BA3D0] dark:text-[#7BB8DC] tabular-nums w-[7.5rem] sm:w-auto">
                      {formatStepTime(ev.at) || '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-gray-800 dark:text-gray-200 leading-snug">{ev.message || ev.type || 'Update'}</p>
                      {ev.status ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Status: {ev.status}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default OrderTrackingTimeline;
