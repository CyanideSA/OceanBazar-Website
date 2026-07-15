# Backup And Restore Runbook

## Scope

This runbook covers operational backup/restore for the OceanBazar production Postgres database.

- Primary DB: Postgres (Neon or self-hosted Postgres-compatible)
- Backup format: compressed `pg_dump` custom format (`.dump`)
- Target objective baseline:
  - RPO: 24h (or better if snapshots/PITR enabled)
  - RTO: 60m for full recovery drill

## Prerequisites

- `pg_dump` and `pg_restore` installed
- Network access to database host
- Rotating service credential with least privilege to read/write DB
- Secure backup storage location (encrypted at rest)

## Environment Variables

Use these environment variables in local shell/CI:

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `BACKUP_DIR` (optional, defaults to `./backups`)

## Backup Procedure

1. Create a timestamped backup:
   - `pwsh ./scripts/db-backup.ps1`
2. Verify output file exists and size is reasonable (non-trivial).
3. Upload/archive backup to secure storage.
4. Record checksum and retention date.

## Restore Procedure (Dry Run First)

1. Provision a restore target DB (never restore directly to primary first).
2. Run restore:
   - `pwsh ./scripts/db-restore.ps1 -BackupFile "<path-to-dump>" -TargetDb "<target-db-name>"`
3. Run app smoke checks against restore target:
   - API health
   - login/auth
   - catalog/listings
4. Compare row counts on key tables (`users`, `orders`, `products`) with expected ranges.

## Recovery Drill Cadence

- Weekly: backup creation + checksum validation
- Monthly: full restore drill to isolated DB
- Quarterly: timed incident simulation against RTO

## Incident Checklist

- Identify incident class (data corruption, accidental delete, infra outage)
- Freeze mutating jobs if required
- Select restore point (latest healthy backup/snapshot)
- Restore to staging target first
- Validate business-critical flows
- Promote restore target only after sign-off

## Retention Guidance

- Daily backups: retain 14 days
- Weekly backups: retain 8 weeks
- Monthly backups: retain 12 months

Adjust by legal/compliance policy and storage budget.
