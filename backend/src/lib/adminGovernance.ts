import { Request } from 'express';
import { prisma } from './prisma';

import { v4 as uuidv4 } from 'uuid';
import { scheduleFlashCampaign } from './flashSalesService';

let govSchemaReady = false;

export async function ensureAdminGovernanceSchema(): Promise<void> {
  if (govSchemaReady) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_role_permissions (
        role VARCHAR(30) PRIMARY KEY,
        permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_pending_changes (
        id TEXT PRIMARY KEY,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        resource_id TEXT,
        resource_label TEXT,
        payload JSONB NOT NULL,
        summary TEXT NOT NULL,
        detail JSONB,
        requested_by TEXT NOT NULL,
        requested_by_name TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        review_note TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS profile_image TEXT
    `);
  } catch {
    /* non-fatal */
  }
  govSchemaReady = true;
}

export type AdminReqUser = {
  userId?: string;
  adminId?: string;
  role?: string;
  name?: string;
  email?: string;
};

export function getAdminFromReq(req: Request): AdminReqUser {
  const a = req.admin;
  if (!a) return {};
  return {
    userId: a.adminId != null ? String(a.adminId) : undefined,
    adminId: a.adminId != null ? String(a.adminId) : undefined,
    role: String(a.role || '').toLowerCase(),
  };
}

export function isSuperAdmin(req: Request): boolean {
  const role = getAdminFromReq(req).role;
  return role === 'super_admin';
}

export interface QueueChangeOptions {
  module: string;
  action: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  summary: string;
  payload: unknown;
  detail?: unknown;
  apply: () => Promise<unknown>;
}

/** Super admin applies immediately; others queue for verification. */
export async function applyOrQueueChange(req: Request, opts: QueueChangeOptions) {
  await ensureAdminGovernanceSchema();
  if (isSuperAdmin(req)) {
    const result = await opts.apply();
    return { applied: true, pending: false, result };
  }

  const admin = getAdminFromReq(req);

  // Dedupe: don't stack identical pending requests for the same resource.
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM admin_pending_changes
    WHERE module = ${opts.module}
      AND action = ${opts.action}
      AND resource_id IS NOT DISTINCT FROM ${opts.resourceId ?? null}
      AND status = 'pending'
    LIMIT 1
  `;
  if (existing.length) {
    return {
      applied: false,
      pending: true,
      pendingId: existing[0].id,
      duplicate: true,
      message: 'Already awaiting Super Admin approval',
    };
  }

  const id = uuidv4();
  await prisma.$executeRaw`
    INSERT INTO admin_pending_changes (
      id, module, action, resource_id, resource_label, payload, summary, detail,
      requested_by, requested_by_name, status, created_at
    )
    VALUES (
      ${id}, ${opts.module}, ${opts.action}, ${opts.resourceId ?? null}, ${opts.resourceLabel ?? null},
      ${JSON.stringify(opts.payload)}::jsonb, ${opts.summary},
      ${opts.detail ? JSON.stringify(opts.detail) : null}::jsonb,
      ${admin.adminId ?? 'unknown'}, ${admin.adminId ? `Admin #${admin.adminId}` : 'Admin'},
      'pending', NOW()
    )
  `;

  return {
    applied: false,
    pending: true,
    pendingId: id,
    message: 'Submitted for Super Admin verification',
  };
}

export async function listPendingChanges(status = 'pending', limit = 100) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM admin_pending_changes
    WHERE status = ${status}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows || [];
}

export async function reviewPendingChange(
  id: string,
  approve: boolean,
  reviewerId: string,
  reviewNote?: string,
) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM admin_pending_changes WHERE id = ${id} AND status = 'pending' LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) return { ok: false, error: 'Not found or already reviewed' };

  if (!approve) {
    await prisma.$executeRaw`
      UPDATE admin_pending_changes
      SET status = 'rejected', reviewed_by = ${reviewerId}, review_note = ${reviewNote ?? null}, reviewed_at = NOW()
      WHERE id = ${id}
    `;
    return { ok: true, status: 'rejected' };
  }

  await prisma.$executeRaw`
    UPDATE admin_pending_changes
    SET status = 'approved', reviewed_by = ${reviewerId}, review_note = ${reviewNote ?? null}, reviewed_at = NOW()
    WHERE id = ${id}
  `;

  if (row.module === 'flashSales' && row.action === 'schedule' && row.resource_id) {
    try {
      await scheduleFlashCampaign(String(row.resource_id));
    } catch (err) {
      console.error('[governance] flash schedule re-apply failed:', (err as Error).message);
    }
  }

  return { ok: true, status: 'approved', row };
}

export async function getRolePermissions(role: string): Promise<Record<string, unknown> | null> {
  const rows = await prisma.$queryRaw<{ permissions: unknown }[]>`
    SELECT permissions FROM admin_role_permissions WHERE role = ${role.toLowerCase()} LIMIT 1
  `;
  return (rows?.[0]?.permissions as Record<string, unknown>) || null;
}

export async function saveRolePermissions(role: string, permissions: unknown, updatedBy: string) {
  await prisma.$executeRaw`
    INSERT INTO admin_role_permissions (role, permissions, updated_at, updated_by)
    VALUES (${role.toLowerCase()}, ${JSON.stringify(permissions)}::jsonb, NOW(), ${updatedBy})
    ON CONFLICT (role) DO UPDATE SET
      permissions = EXCLUDED.permissions,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
  `;
}

export async function getSearchAnalytics(limit = 500, offset = 0) {
  const summary = await prisma.$queryRaw<any[]>`
    SELECT query, COUNT(*)::int AS search_count,
      MAX(created_at) AS last_searched,
      MIN(created_at) AS first_searched
    FROM search_logs
    GROUP BY query
    ORDER BY search_count DESC, last_searched DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const total = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(DISTINCT query)::bigint AS c FROM search_logs
  `;
  const recent = await prisma.$queryRaw<any[]>`
    SELECT id, query, user_id, created_at FROM search_logs
    ORDER BY created_at DESC LIMIT 50
  `;
  const trend = await prisma.$queryRaw<Array<{ day: Date; searches: number }>>`
    SELECT DATE(created_at) AS day, COUNT(*)::int AS searches
    FROM search_logs
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `;

  let zeroResultTerms: Array<{ query: string; search_count: number }> = [];
  try {
    const col = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'search_logs' AND column_name = 'result_count'
      LIMIT 1
    `;
    if (col?.length) {
      zeroResultTerms = await prisma.$queryRaw<Array<{ query: string; search_count: number }>>`
        SELECT query, COUNT(*)::int AS search_count
        FROM search_logs
        WHERE result_count = 0
        GROUP BY query
        ORDER BY search_count DESC
        LIMIT 50
      `;
    }
  } catch {
    /* result_count column not available */
  }

  return {
    terms: summary || [],
    totalDistinct: Number(total?.[0]?.c ?? 0),
    recent: recent || [],
    trend: (trend || []).map((r) => ({
      day: r.day,
      searches: Number(r.searches ?? 0),
    })),
    zeroResultTerms,
  };
}
