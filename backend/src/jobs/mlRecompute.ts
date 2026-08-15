import { appLog } from '../lib/appLog';
import { isMlConfigured, recompute } from '../services/mlClient';

/**
 * Nightly batch that asks the ML service to recompute churn / LTV / demand
 * predictions and persist them to `ml_predictions` + `customers`.
 *
 * Disabled when ML_SERVICE_URL is unset or ML_RECOMPUTE_CRON=false.
 */

export async function runMlRecompute(): Promise<void> {
  if (!isMlConfigured()) {
    appLog('info', 'ml_recompute_skipped', { reason: 'ml_not_configured' });
    return;
  }
  try {
    const result = await recompute({ churn: true, demand: true, window_days: 30 });
    appLog('info', 'ml_recompute_complete', { ...result });
  } catch (e) {
    appLog('warn', 'ml_recompute_failed', {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

function msUntilNextLocalHour(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startMlRecomputeCron(): void {
  if (process.env.ML_RECOMPUTE_CRON === 'false') return;
  if (!isMlConfigured()) return;

  const hour = Number(process.env.ML_RECOMPUTE_HOUR ?? 3);
  setTimeout(() => {
    void runMlRecompute();
    setInterval(() => void runMlRecompute(), 24 * 60 * 60 * 1000);
  }, msUntilNextLocalHour(hour));
  appLog('info', 'ml_recompute_cron_started', { hour });
}
