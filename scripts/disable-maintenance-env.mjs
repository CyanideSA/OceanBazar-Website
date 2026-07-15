#!/usr/bin/env node
/**
 * Turn off maintenance in config/maintenance.env and re-sync all env files.
 * Usage: node scripts/disable-maintenance-env.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'config', 'maintenance.env');

if (!fs.existsSync(sourcePath)) {
  console.error('Missing config/maintenance.env');
  process.exit(1);
}

let text = fs.readFileSync(sourcePath, 'utf8');
text = text.replace(/^MAINTENANCE_MODE=.*$/m, 'MAINTENANCE_MODE=false');
text = text.replace(/^VITE_MAINTENANCE_MODE=.*$/m, 'VITE_MAINTENANCE_MODE=false');
fs.writeFileSync(sourcePath, text, 'utf8');

const r = spawnSync(process.execPath, ['scripts/sync-maintenance-env.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
