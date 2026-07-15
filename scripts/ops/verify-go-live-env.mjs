#!/usr/bin/env node
/**
 * Prints go-live env checklist (storefront build + BFF runtime).
 * Usage: node scripts/ops/verify-go-live-env.mjs
 */
const required = {
  storefront_build: ['NEXT_PUBLIC_ADMIN_CRM_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL'],
  bff_runtime: ['ANALYTICS_CRON', 'EVENT_DLQ_CRON', 'DLQ_WORKER'],
};

const optional = ['EVENT_DLQ_POLL_MS', 'EVENT_DLQ_BATCH', 'ANALYTICS_NIGHTLY_HOUR', 'WEBSOCKET_STOMP_ENABLED'];

function check(group, keys) {
  console.log(`\n${group}:`);
  for (const k of keys) {
    const v = process.env[k];
    const ok = v !== undefined && String(v).trim() !== '';
    console.log(`  ${ok ? '✓' : '✗'} ${k}=${ok ? v : '(missing — use default in docker-compose)'}`);
  }
}

console.log('OceanBazar go-live env verification (process.env from caller shell / compose)');
check('Storefront (build-time)', required.storefront_build);
check('BFF workers (runtime)', required.bff_runtime);
console.log('\nOptional:');
for (const k of optional) {
  if (process.env[k]) console.log(`  · ${k}=${process.env[k]}`);
}
console.log('\nDLQ disable: set EVENT_DLQ_CRON=false or DLQ_WORKER=false');
console.log('Analytics disable: set ANALYTICS_CRON=false');
