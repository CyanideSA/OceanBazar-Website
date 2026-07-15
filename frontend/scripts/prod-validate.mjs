import { spawn } from 'node:child_process';
import process from 'node:process';
import http from 'node:http';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = process.cwd();
const FRONTEND_DIR = ROOT;
const ADMIN_DIR = `${ROOT}/../admin-frontend-react`;
const BACKEND_DIR = `${ROOT}/../backend`;
const LOCAL_BYPASS = '127.0.0.1,localhost';
const BASE_ENV = {
  ...process.env,
  HTTP_PROXY: '',
  HTTPS_PROXY: '',
  ALL_PROXY: '',
  NO_PROXY: LOCAL_BYPASS,
  no_proxy: LOCAL_BYPASS,
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const cp = spawn(command, args, {
      cwd: options.cwd || ROOT,
      stdio: options.stdio || 'inherit',
      shell: process.platform === 'win32',
      env: { ...BASE_ENV, ...(options.env || {}) },
    });
    cp.on('error', reject);
    cp.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

function start(command, args, options = {}) {
  const cp = spawn(command, args, {
    cwd: options.cwd || ROOT,
    stdio: options.stdio || 'pipe',
    shell: process.platform === 'win32',
    env: { ...BASE_ENV, ...(options.env || {}) },
  });
  cp.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  cp.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  return cp;
}

function parseDatabaseUrlFromBackendEnv() {
  const envPath = `${BACKEND_DIR}/.env`;
  if (!existsSync(envPath)) return null;
  const raw = readFileSync(envPath, 'utf8');
  const m = raw.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function checkHttp(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
      const ok = res.statusCode && res.statusCode < 500;
      res.resume();
      if (ok) resolve();
      else reject(new Error(`status ${res.statusCode}`));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function logBackendDbHint() {
  const conn = parseDatabaseUrlFromBackendEnv();
  if (!conn) {
    console.warn(
      '[prod-validate] No backend/.env — copy backend/.env.example; use DATABASE_URL for Docker Postgres on port 5433 (see README).'
    );
    return;
  }
  try {
    const normalized = conn.replace(/^postgresql:\/\//i, 'http://');
    const u = new URL(normalized);
    console.log(
      `[prod-validate] backend/.env DATABASE_URL host → ${u.hostname}:${u.port || '(default 5432)'}`
    );
  } catch {
    /* ignore parse errors */
  }
}

async function ensureDatabasePortReachable() {
  const conn = parseDatabaseUrlFromBackendEnv();
  if (!conn) return;
  try {
    const normalized = conn.replace(/^postgresql:\/\//i, 'http://');
    const u = new URL(normalized);
    const host = u.hostname;
    const port = Number(u.port || '5432');
    await new Promise((resolve, reject) => {
      const socket = net.connect({ host, port });
      socket.setTimeout(4000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(null);
      });
      socket.once('timeout', () => {
        socket.destroy();
        reject(new Error(`timeout connecting to ${host}:${port}`));
      });
      socket.once('error', reject);
    });
  } catch (err) {
    throw new Error(
      `[prod-validate] DATABASE_URL is unreachable (${err.message}). Start the database first (e.g. "docker compose up postgres -d"), or fix backend/.env DATABASE_URL host/port.`
    );
  }
}

async function waitForHttp(url, timeoutMs = 120000) {
  const startedAt = Date.now();
  let lastErr = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await checkHttp(url);
      return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for ${url}. Last error: ${lastErr?.message || 'none'}`);
}

async function waitForStorefront(url) {
  try {
    await waitForHttp(new URL('/robots.txt', url).href, 180000);
    return;
  } catch {
    await waitForHttp(new URL('/', url).href, 180000);
  }
}

function findFreePort(startPort, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => tryPort(port + 1));
      server.listen(port, host, () => {
        const { port: freePort } = server.address();
        server.close(() => resolve(freePort));
      });
    };
    tryPort(startPort);
  });
}

const API_URL = 'http://127.0.0.1:4000';

async function apiHealthyQuick() {
  try {
    await checkHttp(`${API_URL}/api/health`);
    return true;
  } catch {
    return false;
  }
}

async function stopProcess(cp) {
  if (!cp || cp.killed) return;
  if (process.platform === 'win32' && cp.pid) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(cp.pid), '/T', '/F'], {
        shell: true,
        stdio: 'ignore',
      });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }
  cp.kill('SIGTERM');
}

async function main() {
  const procs = [];
  let startedBff = false;
  try {
    logBackendDbHint();
    await ensureDatabasePortReachable();
    await run('npm', ['run', 'build'], { cwd: BACKEND_DIR });

    // BFF must be up for `next build` (SSG/metadata fetch) and for `next start` SSR.
    if (await apiHealthyQuick()) {
      console.log('[prod-validate] Using existing BFF on port 4000 (skip spawn).');
    } else {
      procs.push(
        start('npm', ['run', 'start'], {
          cwd: BACKEND_DIR,
          env: { ...BASE_ENV, PORT: '4000', NODE_ENV: 'production' },
        })
      );
      startedBff = true;
      await waitForHttp(`${API_URL}/api/health`);
    }

    await run('npm', ['run', 'build'], {
      cwd: FRONTEND_DIR,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    });
    await run('npm', ['run', 'build'], { cwd: ADMIN_DIR });

    const storefrontPort = await findFreePort(3100, '0.0.0.0');
    const adminPort = await findFreePort(4173);
    const storefrontUrl = `http://127.0.0.1:${storefrontPort}`;
    const adminUrl = `http://127.0.0.1:${adminPort}`;

    // Bind 0.0.0.0 so IPv4 localhost works reliably with Playwright on Windows (avoid ::1-only listens).
    procs.push(start('npm', ['run', 'start', '--', '-H', '0.0.0.0', '-p', String(storefrontPort)], {
      cwd: FRONTEND_DIR,
      env: { ...BASE_ENV, NO_PROXY: LOCAL_BYPASS, no_proxy: LOCAL_BYPASS },
    }));
    procs.push(start('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(adminPort)], {
      cwd: ADMIN_DIR,
      env: { ...BASE_ENV, NO_PROXY: LOCAL_BYPASS, no_proxy: LOCAL_BYPASS },
    }));

    await waitForStorefront(storefrontUrl);
    await waitForHttp(adminUrl);

    await run(
      'npx',
      [
        'playwright',
        'test',
        'tests/e2e/deterministic',
        '--project=chromium',
        '--workers=1',
        '--max-failures=1',
      ],
      {
        cwd: FRONTEND_DIR,
        env: {
          ...BASE_ENV,
          PLAYWRIGHT_BASE_URL: storefrontUrl,
          PLAYWRIGHT_ADMIN_URL: adminUrl,
          PLAYWRIGHT_API_URL: API_URL,
        },
      }
    );
  } finally {
    for (const cp of procs) {
      await stopProcess(cp);
    }
    if (startedBff) {
      console.log('[prod-validate] Stopped BFF process started by this script (port 4000).');
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
