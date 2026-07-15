#!/usr/bin/env node
/**
 * Phase 10 staging smoke — run against BFF base URL.
 * Usage: node scripts/ops/staging-smoke.mjs https://api.staging.example.com
 */

const defaultStagingAlb =
  'http://oceanbazar-staging-alb-247751821.ap-southeast-1.elb.amazonaws.com';
const base = (process.argv[2] || process.env.BFF_URL || defaultStagingAlb).replace(/\/$/, '');
const insecureTls =
  process.env.STAGING_SMOKE_INSECURE_TLS === '1' || /^https:\/\//i.test(base);
const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN?.trim();
const metricsOptional = process.env.SMOKE_METRICS_OPTIONAL === '1';

if (insecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const defaultHeaders = {};
if (bypassToken) {
  defaultHeaders['x-maintenance-bypass'] = bypassToken;
}

const checks = [
  { name: 'health', path: '/api/health', expect: (j) => j.status === 'ok' },
  { name: 'api catalog', path: '/api', expect: (j) => j && typeof j === 'object' },
  {
    name: 'metrics',
    path: '/metrics',
    optional: metricsOptional,
    expect: (t) => typeof t === 'string' && t.includes('bff_'),
  },
];

let failed = 0;

for (const c of checks) {
  try {
    const res = await fetch(`${base}${c.path}`, { headers: defaultHeaders });
    const raw = await res.text();
    if (c.path !== '/metrics') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('<')) {
        console.error(
          `FAIL ${c.name}: got HTML (wrong host/path?). Use BFF URL with /api/health, e.g. https://your-api.example.com`
        );
        failed += 1;
        continue;
      }
    }
    const body = c.path === '/metrics' ? raw : JSON.parse(raw);
    if (!res.ok || !c.expect(body)) {
      if (c.optional && res.status === 404) {
        console.warn(`WARN ${c.name} (${res.status}) — optional; rebuild BFF image or hot-patch dist`);
      } else {
        console.error(`FAIL ${c.name} (${res.status})`);
        failed += 1;
      }
    } else {
      console.log(`OK   ${c.name}`);
    }
  } catch (e) {
    if (c.optional) {
      console.warn(`WARN ${c.name}:`, e.message);
    } else {
      console.error(`FAIL ${c.name}:`, e.message);
      failed += 1;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('All smoke checks passed.');
