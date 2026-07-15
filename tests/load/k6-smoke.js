/**
 * Smoke / campaign load test (k6).
 * Install: https://k6.io/docs/get-started/installation/
 *
 * Usage:
 *   k6 run -e BASE_URL=http://localhost:3000 tests/load/k6-smoke.js
 *   k6 run -e BASE_URL=https://staging.oceanbazar.com -e VUS=50 -e DURATION=2m tests/load/k6-smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const BFF = __ENV.BFF_URL || 'http://localhost:4000';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const home = http.get(`${BASE}/en`);
  check(home, { 'home 200': (r) => r.status === 200 });

  const health = http.get(`${BFF}/api/health`);
  check(health, { 'bff health': (r) => r.status === 200 });

  sleep(1);
}
