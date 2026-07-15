#!/usr/bin/env node
/**
 * Merge config/maintenance.env into local + docker env files (idempotent).
 * Usage: node scripts/sync-maintenance-env.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'config', 'maintenance.env');

if (!fs.existsSync(sourcePath)) {
  console.error('Missing config/maintenance.env — copy from config/maintenance.env.example');
  process.exit(1);
}

const raw = fs.readFileSync(sourcePath, 'utf8');
const vars = new Map();
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 1) continue;
  vars.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
}

const KEYS = [...vars.keys()];

function mergeEnvFile(filePath) {
  const abs = path.join(root, filePath);
  let lines = [];
  if (fs.existsSync(abs)) {
    lines = fs.readFileSync(abs, 'utf8').split('\n');
  }
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return true;
    const key = t.split('=')[0]?.trim();
    return !KEYS.includes(key);
  });
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  const block = [
    '',
    '# ── Maintenance lock (sync-maintenance-env.mjs) ──',
    ...KEYS.map((k) => `${k}=${vars.get(k)}`),
    '',
  ];
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, [...kept, ...block].join('\n'), 'utf8');
  console.log('updated', filePath);
}

mergeEnvFile('.env');
mergeEnvFile('frontend/.env.local');
mergeEnvFile('backend/.env');
mergeEnvFile('admin-frontend-react/.env.local');

console.log('\nBypass URL (storefront):');
console.log(`  https://oceanbazar.com.bd/en?bypass=${vars.get('MAINTENANCE_BYPASS_TOKEN')}`);
console.log(`  http://localhost:3000/en?bypass=${vars.get('MAINTENANCE_BYPASS_TOKEN')} (local)`);
