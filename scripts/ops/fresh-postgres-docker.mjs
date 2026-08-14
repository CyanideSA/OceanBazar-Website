#!/usr/bin/env node
/**
 * Wipe the Docker Postgres volume and apply all Prisma migrations on an empty database.
 * Use on Hetzner (or local Docker) when you do NOT want AWS/RDS data.
 *
 *   node scripts/ops/fresh-postgres-docker.mjs --yes
 *   node scripts/ops/fresh-postgres-docker.mjs --yes --seed
 *   node scripts/ops/fresh-postgres-docker.mjs --yes --seed --up
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const seed = args.includes('--seed');
const bringUp = args.includes('--up');

function run(cmd, cmdArgs, { allowFail = false } = {}) {
  const printable = [cmd, ...cmdArgs].join(' ');
  console.log(`\n→ ${printable}`);
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0 && !allowFail) {
    process.exit(r.status ?? 1);
  }
  return r.status ?? 0;
}

function capture(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `${cmd} failed`);
    process.exit(r.status ?? 1);
  }
  return (r.stdout || '').trim();
}

if (!confirmed) {
  console.error(`
fresh-postgres-docker: destructive — deletes the postgres_data Docker volume.

This gives you an empty Postgres with schema from Prisma migrations only.
Do NOT use scripts/ops/baseline-prisma-docker.mjs on a fresh volume (that is for legacy DBs).

Re-run with --yes to continue:
  node scripts/ops/fresh-postgres-docker.mjs --yes
  node scripts/ops/fresh-postgres-docker.mjs --yes --seed --up
`);
  process.exit(1);
}

console.log('Stopping compose services…');
run('docker', ['compose', 'down', '--remove-orphans'], { allowFail: true });

const volumes = capture('docker', ['volume', 'ls', '-q'])
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.endsWith('_postgres_data') || v === 'postgres_data');

if (volumes.length === 0) {
  console.log('No postgres_data volume found (already fresh).');
} else {
  for (const vol of volumes) {
    console.log(`Removing volume ${vol}…`);
    run('docker', ['volume', 'rm', '-f', vol], { allowFail: true });
  }
}

console.log('\nStarting Postgres…');
run('docker', ['compose', 'up', 'postgres', '-d', '--wait']);

console.log('\nApplying Prisma schema to the empty database…');
// The Prisma migration history is interleaved with Java/Flyway-owned catalog
// tables and cannot run standalone on an empty DB (see docs/HETZNER_DEPLOYMENT.md).
// The schema.prisma is a complete superset, so push it directly, after enabling
// the required extensions and restoring DB-level updated_at defaults that raw-SQL
// routes rely on.
const BOOTSTRAP_DB = [
  'echo "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gin;" | npx prisma db execute --url "$DATABASE_URL" --stdin',
  'npx prisma db push --accept-data-loss',
  'npx prisma db execute --url "$DATABASE_URL" --file prisma/dev-fix-updated-at-defaults.sql',
].join(' && ');
run('docker', ['compose', 'run', '--rm', '--no-deps', '--build', 'api', 'sh', '-c', BOOTSTRAP_DB]);

if (seed) {
  console.log('\nSeeding default admin + demo data…');
  // The production api image is pruned of devDependencies (no ts-node), so install
  // ts-node/typescript on the fly to run the TypeScript seed (mirrors hetzner-run-seed.sh).
  run('docker', ['compose', 'run', '--rm', '--no-deps', 'api', 'sh', '-c',
    'npm install --no-save ts-node typescript && TS_NODE_TRANSPILE_ONLY=1 npx ts-node prisma/seed.ts']);
}

if (bringUp) {
  console.log('\nStarting full stack…');
  run('docker', ['compose', '--profile', 'full', 'up', '-d', '--build']);
}

console.log(`
✓ Fresh Postgres ready (Prisma schema pushed).
${seed ? '  Seed complete — see backend/prisma/seed.ts for default credentials.' : '  Run with --seed to create default admin users.'}
${bringUp ? '  Full stack is up (docker compose --profile full).' : '  Start apps: docker compose --profile full --profile production up -d'}
`);
