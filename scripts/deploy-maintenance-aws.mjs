#!/usr/bin/env node
/**
 * Deploy global maintenance to AWS:
 * 1) Build maintenance-only static storefront → S3 + CloudFront invalidation
 * 2) Enable MAINTENANCE_MODE on ECS BFF + Java API task definitions
 *
 * Env (or flags):
 *   AWS_REGION (default ap-southeast-1)
 *   S3_BUCKET_STOREFRONT (default oceanbazar-staging-storefront-537595753814)
 *   CLOUDFRONT_STOREFRONT_ID (default ER9ZY0OM3HPZ9)
 *   ECS_CLUSTER (default oceanbazar-staging-cluster)
 *   ECS_BFF_SERVICE (default oceanbazar-staging-bff)
 *   ECS_JAVA_SERVICE (default oceanbazar-staging-java-api)
 *
 * Reads MAINTENANCE_* from config/maintenance.env when present.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = process.env.AWS_REGION || 'ap-southeast-1';
const bucket =
  process.env.S3_BUCKET_STOREFRONT || 'oceanbazar-staging-storefront-537595753814';
const distributionId = process.env.CLOUDFRONT_STOREFRONT_ID || 'ER9ZY0OM3HPZ9';
const cluster = process.env.ECS_CLUSTER || 'oceanbazar-staging-cluster';
const bffService = process.env.ECS_BFF_SERVICE || 'oceanbazar-staging-bff';
const javaService = process.env.ECS_JAVA_SERVICE || 'oceanbazar-staging-java-api';

function loadMaintenanceEnv() {
  const p = path.join(root, 'config', 'maintenance.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, AWS_REGION: region, AWS_DEFAULT_REGION: region },
    ...opts,
  });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

async function registerMaintenanceTaskDef(familyPrefix) {
  const serviceName =
    familyPrefix === 'bff' ? bffService : javaService;
  const describeSvc = spawnSync(
    'aws',
    [
      'ecs',
      'describe-services',
      '--cluster',
      cluster,
      '--services',
      serviceName,
      '--query',
      'services[0].taskDefinition',
      '--output',
      'text',
    ],
    { encoding: 'utf8', shell: true },
  );
  if (describeSvc.status !== 0) {
    console.error(describeSvc.stderr || describeSvc.stdout);
    process.exit(1);
  }
  const taskDefArn = describeSvc.stdout.trim();
  const family = taskDefArn.split('/').pop().split(':')[0];

  const describeTd = spawnSync(
    'aws',
    ['ecs', 'describe-task-definition', '--task-definition', taskDefArn, '--output', 'json'],
    { encoding: 'utf8', shell: true },
  );
  if (describeTd.status !== 0) process.exit(1);
  const td = JSON.parse(describeTd.stdout).taskDefinition;
  const container = td.containerDefinitions[0];

  const maintenanceKeys = new Set([
    'MAINTENANCE_MODE',
    'MAINTENANCE_BYPASS_TOKEN',
    'MAINTENANCE_RETRY_AFTER',
    'MAINTENANCE_COOKIE_DOMAIN',
    'MAINTENANCE_ALLOW_HEALTH_PROBE',
  ]);
  const env = (container.environment || []).filter((e) => !maintenanceKeys.has(e.name));
  env.push(
    { name: 'MAINTENANCE_MODE', value: 'true' },
    {
      name: 'MAINTENANCE_BYPASS_TOKEN',
      value: process.env.MAINTENANCE_BYPASS_TOKEN || '',
    },
    { name: 'MAINTENANCE_RETRY_AFTER', value: process.env.MAINTENANCE_RETRY_AFTER || '3600' },
    {
      name: 'MAINTENANCE_COOKIE_DOMAIN',
      value: process.env.MAINTENANCE_COOKIE_DOMAIN || '.oceanbazar.com.bd',
    },
    {
      name: 'MAINTENANCE_ALLOW_HEALTH_PROBE',
      value: process.env.MAINTENANCE_ALLOW_HEALTH_PROBE || 'true',
    },
  );
  container.environment = env;

  const registerPayload = {
    family: td.family,
    taskRoleArn: td.taskRoleArn,
    executionRoleArn: td.executionRoleArn,
    networkMode: td.networkMode,
    containerDefinitions: td.containerDefinitions,
    requiresCompatibilities: td.requiresCompatibilities,
    cpu: td.cpu,
    memory: td.memory,
    ...(td.runtimePlatform ? { runtimePlatform: td.runtimePlatform } : {}),
  };

  const tmp = path.join(os.tmpdir(), `oceanbazar-ecs-task-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(registerPayload), 'utf8');
  const fileUri = `file://${tmp.replace(/\\/g, '/')}`;

  const reg = spawnSync(
    'aws',
    ['ecs', 'register-task-definition', '--cli-input-json', fileUri],
    { encoding: 'utf8', shell: false, env: { ...process.env, AWS_REGION: region, AWS_DEFAULT_REGION: region } },
  );
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  if (reg.status !== 0) {
    console.error(reg.stderr || reg.stdout);
    process.exit(1);
  }
  const newArn = JSON.parse(reg.stdout).taskDefinition.taskDefinitionArn;
  run('aws', [
    'ecs',
    'update-service',
    '--cluster',
    cluster,
    '--service',
    serviceName,
    '--task-definition',
    newArn,
    '--force-new-deployment',
  ]);
  console.log(`✓ ECS ${serviceName} → ${newArn} (maintenance env applied)`);
}

loadMaintenanceEnv();

const skipBuild =
  process.argv.includes('--skip-build') || process.env.SKIP_MAINTENANCE_BUILD === '1';
const ecsOnly = process.argv.includes('--ecs-only');
const s3Only = process.argv.includes('--s3-only');

if (!process.env.MAINTENANCE_BYPASS_TOKEN) {
  console.warn('Warning: MAINTENANCE_BYPASS_TOKEN not set — staff bypass will not work on API.');
}

if (!ecsOnly) {
  if (!skipBuild) {
    console.log('\n── Build maintenance storefront (static) ──\n');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    run(npmCmd, ['run', 'build:s3:maintenance'], { cwd: path.join(root, 'frontend') });
  } else {
    console.log('\n── Skipping build (--skip-build) ──\n');
  }

  console.log('\n── Upload to S3 ──\n');
  const outDir = path.join(root, 'frontend', 'out');
  run('aws', ['s3', 'sync', outDir, `s3://${bucket}/`, '--delete'], { cwd: root });

  console.log('\n── Invalidate CloudFront ──\n');
  run('aws', [
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    distributionId,
    '--paths',
    '/*',
  ]);
}

if (!s3Only) {
  console.log('\n── ECS API maintenance lock ──\n');
  await registerMaintenanceTaskDef('bff');
  await registerMaintenanceTaskDef('java');
}

console.log('\n✓ Production maintenance is live on AWS.');
console.log(`  Storefront: https://oceanbazar.com.bd/`);
console.log(
  `  Staff bypass: https://oceanbazar.com.bd/en?bypass=${process.env.MAINTENANCE_BYPASS_TOKEN || '<token>'}`,
);
