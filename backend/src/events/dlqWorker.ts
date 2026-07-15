import { retryFailedEvents } from './publisher';
import { appLog } from '../lib/appLog';

const POLL_MS = Number(process.env.EVENT_DLQ_POLL_MS || 5 * 60 * 1000);
const BATCH = Number(process.env.EVENT_DLQ_BATCH || 25);

let timer: ReturnType<typeof setInterval> | null = null;

export function startDlqWorker(): void {
  if (process.env.EVENT_DLQ_CRON === 'false' || process.env.DLQ_WORKER === 'false') return;
  if (timer) return;

  const tick = async () => {
    try {
      const n = await retryFailedEvents(BATCH);
      if (n > 0) {
        appLog('info', 'dlq_retry_batch_complete', { retried: n });
      }
    } catch (e) {
      appLog('error', 'dlq_worker_tick_failed', {
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  void tick();
  timer = setInterval(() => void tick(), POLL_MS);
  appLog('info', 'dlq_worker_started', { pollMs: POLL_MS, batch: BATCH });
}
