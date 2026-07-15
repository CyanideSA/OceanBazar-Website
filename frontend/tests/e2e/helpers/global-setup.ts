import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';

async function checkHttpOk(url: string, timeoutMs = 120_000) {
  const startedAt = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, { timeout: 8000 }, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`status ${res.statusCode}`));
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
      });
      return true;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.warn(`[global-setup] ${url} not reachable:`, lastErr);
  return false;
}

function maybeRunDbSeed() {
  if (process.env.E2E_SKIP_DB_SEED === '1') {
    console.log('[global-setup] Skipping db:seed (E2E_SKIP_DB_SEED=1)');
    return;
  }
  const backendDir = path.resolve(__dirname, '../../../..', 'backend');
  const pkg = path.join(backendDir, 'package.json');
  if (!fs.existsSync(pkg)) {
    console.warn('[global-setup] backend/package.json not found — skip seed');
    return;
  }
  console.log('[global-setup] Running npm run db:seed in backend…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['run', 'db:seed'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.warn('[global-setup] db:seed exited with', r.status, '— storefront order tests may skip');
  }
}

/**
 * Optional DB seed (E2E user + OB-E2E-* order) + verify HTTP servers.
 */
export default async function globalSetup(_config: FullConfig) {
  maybeRunDbSeed();

  const storefrontUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  const adminUrl = process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5173';

  if (await checkHttpOk(new URL('/robots.txt', storefrontUrl).href)) {
    console.log(`[global-setup] ✅ Storefront reachable at ${storefrontUrl}`);
  } else {
    console.warn('[global-setup] ⚠️  Storefront not reachable — tests may fail');
  }

  if (await checkHttpOk(adminUrl)) {
    console.log(`[global-setup] ✅ Admin panel reachable at ${adminUrl}`);
  } else {
    console.warn('[global-setup] ⚠️  Admin panel not reachable — admin tests may fail');
  }
}
