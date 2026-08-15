/**
 * Static export for S3 + rewrite all HTML to maintenance pages (no Next middleware on S3).
 * Usage: node scripts/build-s3-maintenance.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const build = spawnSync(npmCmd, ['run', 'build:s3'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_STATIC_EXPORT: '1',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://oceanbazar.com.bd',
  },
  shell: true,
});

if (build.status !== 0) process.exit(build.status ?? 1);

const apply = spawnSync(process.execPath, ['scripts/apply-s3-maintenance-only.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(apply.status ?? 0);
