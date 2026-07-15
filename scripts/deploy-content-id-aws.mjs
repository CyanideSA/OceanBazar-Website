#!/usr/bin/env node
/**
 * Deploy contentid.oceanbazar.com.bd to AWS:
 * 1) Terraform apply (content-id S3/CloudFront, Route53, BFF env, scale ECS)
 * 2) Build + push BFF Docker image
 * 3) Prisma migrate deploy via one-off ECS task
 * 4) Build content-id SPA + S3 sync + CloudFront invalidation
 *
 * Reads MS SSO vars from backend/.env when not already in environment.
 * Requires: AWS CLI, Docker, Terraform, npm.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = process.env.AWS_REGION || 'ap-southeast-1';
const cluster = process.env.ECS_CLUSTER || 'oceanbazar-staging-cluster';
const bffService = process.env.ECS_BFF_SERVICE || 'oceanbazar-staging-bff';
const tfDir = path.join(root, 'infra', 'terraform');

const skipTerraform = process.argv.includes('--skip-terraform');
const skipDocker = process.argv.includes('--skip-docker');
const skipMigrate = process.argv.includes('--skip-migrate');
const skipStatic = process.argv.includes('--skip-static');
const staticOnly = process.argv.includes('--static-only');

function loadBackendEnv() {
  const p = path.join(root, 'backend', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    let key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
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
  return res;
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, AWS_REGION: region, AWS_DEFAULT_REGION: region },
    ...opts,
  });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    process.exit(res.status ?? 1);
  }
  return res.stdout.trim();
}

function terraformOutput(name) {
  return runCapture('terraform', ['output', '-raw', name], { cwd: tfDir });
}

async function runPrismaMigrate() {
  console.log('\n── Prisma migrate deploy (ECS one-off) ──\n');
  const svcJson = runCapture('aws', [
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
  const taskDefArn = svc.taskDefinition;
  const net = svc.networkConfiguration.awsvpcConfiguration;

  const overrides = {
    containerOverrides: [
      {
        name: 'bff',
        command: ['npx', 'prisma', 'migrate', 'deploy'],
      },
    ],
  };
  const tmp = path.join(os.tmpdir(), `oceanbazar-migrate-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(overrides), 'utf8');

  const runOut = runCapture('aws', [
    'ecs',
    'run-task',
    '--cluster',
    cluster,
    '--task-definition',
    taskDefArn,
    '--launch-type',
    'FARGATE',
    '--network-configuration',
    `awsvpcConfiguration={subnets=[${net.subnets.join(',')}],securityGroups=[${net.securityGroups.join(',')}],assignPublicIp=${net.assignPublicIp || 'DISABLED'}}`,
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
  console.log(`Migration task: ${taskArn}`);
  run('aws', [
    'ecs',
    'wait',
    'tasks-stopped',
    '--cluster',
    cluster,
    '--tasks',
    taskArn,
  ]);

  const desc = JSON.parse(
    runCapture('aws', ['ecs', 'describe-tasks', '--cluster', cluster, '--tasks', taskArn, '--output', 'json']),
  );
  const container = desc.tasks[0].containers.find((c) => c.name === 'bff');
  if (container?.exitCode !== 0) {
    console.error('Prisma migrate failed. Check CloudWatch logs for bff.');
    process.exit(1);
  }
  console.log('✓ Prisma migrate deploy completed');
}

function buildAndPushBff() {
  console.log('\n── Build + push BFF image ──\n');
  const account = runCapture('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text']);
  const ecr = `${account}.dkr.ecr.${region}.amazonaws.com`;
  const image = `${ecr}/oceanbazar-staging-bff:latest`;

  const password = runCapture('aws', ['ecr', 'get-login-password', '--region', region]);
  const login = spawnSync('docker', ['login', '--username', 'AWS', '--password-stdin', ecr], {
    input: password,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (login.status !== 0) process.exit(login.status ?? 1);

  run('docker', ['build', '-f', path.join(root, 'backend', 'Dockerfile'), '-t', image, path.join(root, 'backend')]);
  run('docker', ['push', image]);

  run('aws', [
    'ecs',
    'update-service',
    '--cluster',
    cluster,
    '--service',
    bffService,
    '--force-new-deployment',
  ]);
  console.log('✓ BFF redeploy triggered');
}

function deployStatic() {
  console.log('\n── Build content-id frontend ──\n');
  const frontendDir = path.join(root, 'content-id-frontend');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npmCmd, ['install'], { cwd: frontendDir, stdio: 'inherit' });
  if (install.status !== 0) process.exit(install.status ?? 1);
  run(npmCmd, ['run', 'build'], {
    cwd: frontendDir,
    env: {
      ...process.env,
      VITE_CONTENT_ID_API_SAME_ORIGIN: 'true',
    },
  });

  const bucket = process.env.S3_BUCKET_CONTENT_ID || terraformOutput('content_id_bucket_name');
  const distributionId =
    process.env.CLOUDFRONT_CONTENT_ID_ID || terraformOutput('content_id_cloudfront_distribution_id');

  console.log('\n── Upload to S3 ──\n');
  run('aws', ['s3', 'sync', path.join(frontendDir, 'dist'), `s3://${bucket}/`, '--delete']);

  console.log('\n── Invalidate CloudFront ──\n');
  run('aws', [
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    distributionId,
    '--paths',
    '/*',
  ]);
  console.log(`✓ Static app deployed to s3://${bucket}`);
}

loadBackendEnv();

if (!staticOnly) {
  if (!skipTerraform) {
    console.log('\n── Terraform apply ──\n');
    run('terraform', ['init', '-input=false'], { cwd: tfDir });
    run('terraform', ['apply', '-auto-approve', '-input=false'], { cwd: tfDir });
  }

  if (!skipDocker) {
    buildAndPushBff();
    console.log('\n── Waiting for BFF service stable ──\n');
    run('aws', ['ecs', 'wait', 'services-stable', '--cluster', cluster, '--services', bffService]);
  }

  if (!skipMigrate) {
    await runPrismaMigrate();
  }
}

if (!skipStatic) {
  deployStatic();
}

console.log('\n✓ Content ID tool is live at https://contentid.oceanbazar.com.bd');
console.log('  Add Azure redirect URI if not done:');
console.log('  https://contentid.oceanbazar.com.bd/api/content-id/auth/sso/microsoft/callback');
