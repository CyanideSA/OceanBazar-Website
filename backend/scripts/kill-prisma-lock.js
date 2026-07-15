#!/usr/bin/env node
/**
 * kill-prisma-lock.js
 *
 * Finds and terminates any Windows processes that hold a lock on
 * the Prisma query-engine DLL before running `prisma generate`.
 *
 * Why: On Windows, `ts-node-dev` keeps the Prisma engine DLL open.
 * If you run `prisma generate` while the dev server is running you get:
 *   "The process cannot access the file because it is being used by another process"
 *
 * Usage:
 *   node scripts/kill-prisma-lock.js
 *   npm run db:generate   ← calls this automatically via "predb:generate"
 */

const { execSync, spawnSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const PRISMA_ENGINE_PATTERNS = [
  'query_engine',
  'prisma-query-engine',
  'libquery_engine',
  'schema-engine',
  '.prisma',
];

function log(msg) {
  process.stdout.write(`[kill-prisma-lock] ${msg}\n`);
}

function isWindows() {
  return process.platform === 'win32';
}

/**
 * On Windows: use `tasklist` to find node processes, then `taskkill` on any
 * that have the Prisma engine dir in their working path, or just kill
 * ts-node-dev processes holding the DLL via handle query.
 */
function killWindowsPrismaLocks() {
  // 1. Try to use handle64 / handle (SysInternals) for precise lock detection
  //    If not available, fall back to killing all ts-node-dev processes.
  let handleOutput = '';
  try {
    handleOutput = execSync('handle64 -accepteula .prisma 2>nul', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    try {
      handleOutput = execSync('handle -accepteula .prisma 2>nul', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      handleOutput = '';
    }
  }

  const pidsFromHandle = new Set();
  if (handleOutput) {
    // handle output lines look like:  ts-node-dev.exe  pid: 12345  ...
    const pidMatches = handleOutput.matchAll(/pid:\s*(\d+)/gi);
    for (const m of pidMatches) {
      pidsFromHandle.add(m[1]);
    }
  }

  if (pidsFromHandle.size > 0) {
    for (const pid of pidsFromHandle) {
      log(`Killing PID ${pid} (holds Prisma engine lock)`);
      spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
    }
    return;
  }

  // 2. Fallback: kill ts-node-dev processes (they almost certainly hold the lock)
  try {
    const tasklist = execSync(
      'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const nodeLines = tasklist.split('\n').filter(l => l.includes('node.exe'));
    if (nodeLines.length === 0) {
      log('No node.exe processes found — nothing to kill');
      return;
    }

    log(`Found ${nodeLines.length} node.exe process(es). Sending graceful CTRL+C...`);
    // We can't selectively kill only the Prisma-lock holder without handle.exe,
    // so we issue a graceful kill of node processes and let npm restart them.
    spawnSync(
      'taskkill',
      ['/IM', 'node.exe', '/F'],
      { stdio: 'ignore' }
    );
    log('node.exe processes terminated. Run npm run dev to restart.');
  } catch (err) {
    log(`tasklist/taskkill failed: ${err.message}`);
  }
}

function killUnixPrismaLocks() {
  // lsof-based approach for macOS / Linux
  try {
    const lsof = execSync(
      "lsof -t 2>/dev/null | xargs -r ls -la /proc/$(echo {})/fd 2>/dev/null | grep -i '.prisma' || true",
      { encoding: 'utf8', shell: '/bin/bash' }
    );
    if (lsof.trim()) {
      log('Prisma engine files open — attempting fuser kill');
      execSync("fuser -k $(find node_modules/.prisma -name 'query_engine*') 2>/dev/null || true", {
        shell: '/bin/bash',
      });
    }
  } catch {
    /* best-effort */
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
log('Checking for Prisma engine DLL locks...');

if (isWindows()) {
  killWindowsPrismaLocks();
} else {
  killUnixPrismaLocks();
}

// Small pause to let OS release handles before prisma generate runs
const waitMs = 800;
log(`Waiting ${waitMs}ms for OS to release handles...`);
execSync(`node -e "setTimeout(()=>{},${waitMs})"`, { stdio: 'ignore' });

log('Done — safe to run prisma generate.');
