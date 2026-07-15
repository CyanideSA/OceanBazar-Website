#!/usr/bin/env node
/**
 * Inspect catalog-related tables on staging RDS via one-off ECS BFF task.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const region = process.env.AWS_REGION || 'ap-southeast-1';
const cluster = process.env.ECS_CLUSTER || 'oceanbazar-staging-cluster';
const bffService = process.env.ECS_BFF_SERVICE || 'oceanbazar-staging-bff';

const SQL = `
SELECT to_regclass('public.categories') AS categories,
       to_regclass('public.brands') AS brands,
       to_regclass('public.content_drafts') AS content_drafts;
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'categories'
  ORDER BY 1;
SELECT COUNT(*)::text AS category_count FROM categories;
SELECT COUNT(*)::text AS brand_count FROM brands;
`.trim();

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

const shellCmd = `echo ${JSON.stringify(SQL)} | npx prisma db execute --stdin`;
const overrides = {
  containerOverrides: [{ name: 'bff', command: ['sh', '-c', shellCmd] }],
};
const tmp = path.join(os.tmpdir(), `oceanbazar-diag-${Date.now()}.json`);
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
console.log(`Diagnostic task: ${taskArn}`);

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
  '40',
  '--output',
  'text',
  '--query',
  'events[*].message',
]);
console.log(logs);
process.exit(exitCode === 0 ? 0 : 1);
