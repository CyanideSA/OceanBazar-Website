import { appLog } from '../lib/appLog';
import { syncFlashSalePricingLifecycle } from '../lib/flashSalesService';

let running = false;

async function runFlashSaleLifecycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await syncFlashSalePricingLifecycle();
  } catch (error) {
    appLog('error', 'flash_sale_lifecycle_failed', {
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

export function startFlashSaleLifecycleCron(): void {
  if (process.env.FLASH_SALE_LIFECYCLE_CRON === 'false') return;
  const intervalSeconds = Math.max(15, Number(process.env.FLASH_SALE_LIFECYCLE_INTERVAL_SECONDS ?? 60));
  void runFlashSaleLifecycle();
  const timer = setInterval(() => void runFlashSaleLifecycle(), intervalSeconds * 1000);
  timer.unref();
  appLog('info', 'flash_sale_lifecycle_cron_started', { intervalSeconds });
}
