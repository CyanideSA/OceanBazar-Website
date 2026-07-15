import { PrismaClient } from '@prisma/client';
import { appLog } from '../lib/appLog';

const prisma = new PrismaClient();

const ANALYTICS_VIEWS = [
  'analytics.sales_daily',
  'analytics.top_products',
  'analytics.customer_segments',
  'analytics.inventory_velocity',
  'analytics.ob_points_report',
] as const;

export async function refreshAnalyticsMaterializedViews(
  views: readonly string[] = ANALYTICS_VIEWS
): Promise<void> {
  for (const view of views) {
    try {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      appLog('info', 'analytics_mv_refreshed', { view });
    } catch (e) {
      appLog('warn', 'analytics_mv_refresh_failed', {
        view,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export async function runHourlyAnalyticsRefresh(): Promise<void> {
  await refreshAnalyticsMaterializedViews(['analytics.sales_daily']);
}

export async function runNightlyAnalyticsAggregation(): Promise<void> {
  await refreshAnalyticsMaterializedViews(ANALYTICS_VIEWS);
  appLog('info', 'analytics_nightly_refresh_complete', {});
}

function msUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next.getTime() - now.getTime();
}

function msUntilNextLocalHour(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startAnalyticsCron(): void {
  if (process.env.ANALYTICS_CRON === 'false') return;

  const scheduleHourly = () => {
    setTimeout(() => {
      void runHourlyAnalyticsRefresh();
      setInterval(() => void runHourlyAnalyticsRefresh(), 60 * 60 * 1000);
    }, msUntilNextHour());
  };

  const nightlyHour = Number(process.env.ANALYTICS_NIGHTLY_HOUR ?? 2);
  const scheduleNightly = () => {
    setTimeout(() => {
      void runNightlyAnalyticsAggregation();
      setInterval(() => void runNightlyAnalyticsAggregation(), 24 * 60 * 60 * 1000);
    }, msUntilNextLocalHour(nightlyHour));
  };

  scheduleHourly();
  scheduleNightly();
  appLog('info', 'analytics_cron_started', { nightlyHour });
}
