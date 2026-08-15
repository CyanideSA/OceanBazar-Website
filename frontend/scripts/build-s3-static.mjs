/**
 * Produces ./out for S3 static website hosting (output: 'export').
 * Temporarily renames middleware.ts because Next.js forbids middleware with static export.
 *
 * For full product URLs in `out/`, run with BFF reachable and:
 *   NEXT_FETCH_API_DURING_BUILD=1
 *
 * Usage: node scripts/build-s3-static.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mw = path.join(root, 'middleware.ts');
const mwDisabled = path.join(root, 'middleware.__static_export__.bak.ts');

function restore() {
  if (fs.existsSync(mwDisabled) && !fs.existsSync(mw)) {
    fs.renameSync(mwDisabled, mw);
  }
}

let disabled = false;
let exitCode = 0;
try {
  if (process.argv.includes('--with-api')) {
    process.env.NEXT_FETCH_API_DURING_BUILD = '1';
  }

  if (fs.existsSync(mw)) {
    fs.renameSync(mw, mwDisabled);
    disabled = true;
  }

  process.env.NEXT_STATIC_EXPORT = '1';

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NEXT_STATIC_EXPORT: '1' },
    shell: true,
  });

  if (res.status !== 0) {
    exitCode = res.status ?? 1;
  } else {
    console.log('\n✓ Static export ready: upload the contents of frontend/out/ to your S3 bucket.');
    console.log('  Product HTML pages: run with BFF up and add flag --with-api (sets NEXT_FETCH_API_DURING_BUILD).');
    console.log('  Tip: configure S3/CloudFront root redirect or SPA fallback for URLs with no matching object.\n');
  }
} finally {
  if (disabled) restore();
}
process.exit(exitCode);
