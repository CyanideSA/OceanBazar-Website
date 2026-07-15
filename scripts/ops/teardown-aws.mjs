#!/usr/bin/env node
/**
 * Tear down OceanBazar AWS staging stack (Terraform-managed resources).
 *
 * - Creates a final RDS snapshot (for Hetzner migration backup)
 * - Empties S3 static buckets (required before bucket delete)
 * - Runs terraform destroy
 *
 * Does NOT delete: the shared VPC (use_existing_vpc), or RDS instances
 * outside Terraform state (e.g. oceanbazar-prod-bd if present).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tfDir = path.join(root, 'infra', 'terraform');
const region = process.env.AWS_REGION || 'ap-southeast-1';
const skipSnapshot = process.argv.includes('--skip-snapshot');
const skipDestroy = process.argv.includes('--skip-destroy');

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

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, AWS_REGION: region, AWS_DEFAULT_REGION: region },
    ...opts,
  });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    process.exit(res.status ?? 1);
  }
  return res.stdout.trim();
}

function tfOutput(name) {
  return runCapture('terraform', ['output', '-raw', name], { cwd: tfDir });
}

console.log('\n── OceanBazar AWS teardown ──\n');
console.log(`Region: ${region}`);
console.log(`Terraform dir: ${tfDir}\n`);

if (!fs.existsSync(path.join(tfDir, 'terraform.tfstate'))) {
  console.error('No terraform.tfstate found. Nothing to destroy.');
  process.exit(1);
}

const dbId = 'oceanbazar-staging-pg';
const snapshotId = `oceanbazar-staging-teardown-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

if (!skipSnapshot) {
  console.log(`── Final RDS snapshot: ${snapshotId} ──\n`);
  const exists = spawnSync(
    'aws',
    ['rds', 'describe-db-instances', '--db-instance-identifier', dbId, '--region', region],
    { encoding: 'utf8', env: process.env },
  );
  if (exists.status === 0) {
    run('aws', [
      'rds',
      'create-db-snapshot',
      '--db-instance-identifier',
      dbId,
      '--db-snapshot-identifier',
      snapshotId,
      '--region',
      region,
    ]);
    console.log('Waiting for snapshot (this may take several minutes)...');
    run('aws', [
      'rds',
      'wait',
      'db-snapshot-available',
      '--db-snapshot-identifier',
      snapshotId,
      '--region',
      region,
    ]);
    console.log(`✓ Snapshot ready: ${snapshotId}\n`);
  } else {
    console.log(`RDS ${dbId} not found — skipping snapshot.\n`);
  }
}

console.log('── Empty S3 static buckets ──\n');
for (const key of ['storefront_bucket_name', 'admin_bucket_name', 'content_id_bucket_name']) {
  try {
    const bucket = tfOutput(key);
    if (!bucket) continue;
    console.log(`Emptying s3://${bucket}/ ...`);
    run('aws', ['s3', 'rm', `s3://${bucket}/`, '--recursive', '--region', region]);
  } catch {
    console.log(`Skip ${key} (no output)`);
  }
}

console.log('\n── Scale ECS services to 0 (faster destroy) ──\n');
run('aws', [
  'ecs',
  'update-service',
  '--cluster',
  'oceanbazar-staging-cluster',
  '--service',
  'oceanbazar-staging-bff',
  '--desired-count',
  '0',
  '--region',
  region,
]);
run('aws', [
  'ecs',
  'update-service',
  '--cluster',
  'oceanbazar-staging-cluster',
  '--service',
  'oceanbazar-staging-java-api',
  '--desired-count',
  '0',
  '--region',
  region,
]);

if (!skipDestroy) {
  console.log('\n── terraform destroy (auto-approve) ──\n');
  run('terraform', ['destroy', '-auto-approve', '-input=false'], { cwd: tfDir });
  console.log('\n✓ Terraform destroy completed.');
}

console.log(`
Manual follow-ups (not fully removed by Terraform):
  • CloudFront EAYU1HBA333U0 (admin) + ER9ZY0OM3HPZ9 (storefront):
    subscribed to flat-rate pricing plans — cancel in AWS Console → CloudFront → Billing,
    then delete distributions after billing cycle (or immediately for Free plan).
  • RDS oceanbazar-prod-bd — NOT in Terraform; delete manually if unused.
  • Route53 zone Z00939711CJB69FC7D1JS — remove A/AAAA/CNAME records pointing at AWS.
  • ACM certs (ap-southeast-1 + us-east-1) — delete when unused.
  • IAM user oceanbazar-admin — delete access keys / user when leaving AWS.
  • GitHub secrets (AWS_ROLE_TO_ASSUME, S3_*, CLOUDFRONT_*) — remove or replace for Hetzner.
  • RDS snapshot for migration: oceanbazar-staging-teardown-YYYYMMDD (if snapshot step ran).
`);
