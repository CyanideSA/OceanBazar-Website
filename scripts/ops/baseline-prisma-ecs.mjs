#!/usr/bin/env node
/**
 * Baseline Prisma migration history on staging/prod RDS via one-off ECS BFF task (P3005).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const region = process.env.AWS_REGION || 'ap-southeast-1';
const cluster = process.env.ECS_CLUSTER || 'oceanbazar-staging-cluster';
const bffService = process.env.ECS_BFF_SERVICE || 'oceanbazar-staging-bff';

const BASELINE = [
  '20260410000000_create_base_tables',
  '20260410203000_admin_studio',
  '20260411120000_brands_customers_reviews',
  '20260414000000_add_seen_at_to_ticket_messages',
  '20260415000000_add_brand_to_products',
  '20260505000000_push_referral_ab',
  '20260505225500_admin_totp_2fa',
  '20260505_search_reviews_cod',
  '20260506214600_add_pricing_mode',
  '20260508001000_tier_bands_best_rated',
  '20260525000000_refactor_v2_platform',
  '20260530000000_category_image_url',
  '20260530010000_admin_must_change_password',
  '20260601230000_admin_totp_replay_counter',
  '20260607000000_os_intelligence_layer',
  '20260607010000_ml_prediction_indexes',
  '20260607120000_unified_commerce',
  '20260608120000_unified_integrations',
];

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, AWS_REGION: region, AWS_DEFAULT_REGION: region },
  });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    process.exit(res.status ?? 1);
  }
  return res.stdout.trim();
}

const svcJson = run('aws', [
  'ecs',
  'describe-services',
  '--cluster',
  cluster,
  '--services',
  bffService,
  '--output',
  'json',
]);
const svc = JSON.parse(svcJson).services[0];
const net = svc.networkConfiguration.awsvpcConfiguration;
const taskDefArn = svc.taskDefinition;

const resolveCmd = BASELINE.map((m) => `npx prisma migrate resolve --applied ${m}`).join(' && ');
const shellCmd = `${resolveCmd} && npx prisma migrate deploy`;

const overrides = {
  containerOverrides: [{ name: 'bff', command: ['sh', '-c', shellCmd] }],
};
const tmp = path.join(os.tmpdir(), `oceanbazar-baseline-${Date.now()}.json`);
fs.writeFileSync(tmp, JSON.stringify(overrides), 'utf8');

const runOut = run('aws', [
  'ecs',
  'run-task',
  '--cluster',
  cluster,
  '--task-definition',
  taskDefArn,
  '--launch-type',
  'FARGATE',
  '--network-configuration',
  `awsvpcConfiguration={subnets=[${net.subnets.join(',')}],securityGroups=[${net.securityGroups.join(',')}],assignPublicIp=DISABLED}`,
  '--overrides',
  `file://${tmp.replace(/\\/g, '/')}`,
  '--output',
  'json',
]);
try {
  fs.unlinkSync(tmp);
} catch {
  /* ignore */
}

const taskArn = JSON.parse(runOut).tasks[0].taskArn;
const taskId = taskArn.split('/').pop();
console.log(`Baseline task: ${taskArn}`);

run('aws', ['ecs', 'wait', 'tasks-stopped', '--cluster', cluster, '--tasks', taskArn]);

const desc = JSON.parse(run('aws', ['ecs', 'describe-tasks', '--cluster', cluster, '--tasks', taskArn, '--output', 'json']));
const exitCode = desc.tasks[0].containers.find((c) => c.name === 'bff')?.exitCode;
console.log(`Exit code: ${exitCode}`);

const logs = run('aws', [
  'logs',
  'get-log-events',
  '--log-group-name',
  '/ecs/oceanbazar-staging/bff',
  '--log-stream-name',
  `bff/bff/${taskId}`,
  '--limit',
  '30',
  '--output',
  'text',
  '--query',
  'events[*].message',
]);
console.log(logs);
process.exit(exitCode === 0 ? 0 : 1);
