#!/usr/bin/env node
/**
 * Baseline Prisma migrate history on a non-empty Docker Postgres (P3005).
 * Marks pre-refactor migrations as applied, then runs migrate deploy.
 *
 * Usage (repo root, backend/.env must point at host port 5433):
 *   node scripts/ops/baseline-prisma-docker.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '..', '..', 'backend');

const BASELINE = [
  '20260410000000_create_base_tables',
  '20260410203000_admin_studio',
  '20260411120000_brands_customers_reviews',
  '20260414000000_add_seen_at_to_ticket_messages',
  '20260415000000_add_brand_to_products',
  '20260505000000_push_referral_ab',
  '20260505225500_admin_totp_2fa',
  '20260505_search_reviews_cod',
  '20260506214600_add_pricing_mode',
  '20260508001000_tier_bands_best_rated',
];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: backendDir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const name of BASELINE) {
  console.log(`\n→ resolve --applied ${name}`);
  run('npx', ['prisma', 'migrate', 'resolve', '--applied', name]);
}

console.log('\n→ migrate deploy');
run('npx', ['prisma', 'migrate', 'deploy']);
console.log('\nBaseline + deploy complete.');
