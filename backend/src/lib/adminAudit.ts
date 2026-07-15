import crypto from 'crypto';
import type { Request } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HASH_KEY = 'admin_audit_chain_v1';

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((v) => stableStringify(v)).join(',')}]`;
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export async function recordAdminAudit(
  req: Request,
  opts: { action: string; targetType: string; targetId: string; details?: Record<string, unknown> },
): Promise<void> {
  if (!req.admin?.adminId) return;

  const prev = await prisma.$queryRaw<Array<{ details: unknown }>>`
    SELECT details FROM audit_logs ORDER BY id DESC LIMIT 1
  `;
  const prevHash = typeof (prev[0]?.details as any)?.chainHash === 'string'
    ? String((prev[0]?.details as any)?.chainHash)
    : '';
  const body = {
    requestId: req.requestId ?? null,
    adminId: req.admin.adminId,
    role: req.admin.role,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
    timestamp: Date.now(),
    ...opts.details,
  };
  const chainSource = `${HASH_KEY}|${prevHash}|${opts.action}|${opts.targetType}|${opts.targetId}|${stableStringify(body)}`;
  const chainHash = crypto.createHash('sha256').update(chainSource).digest('hex');

  await prisma.auditLog.create({
    data: {
      adminId: req.admin.adminId,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      details: {
        ...body,
        prevHash,
        chainHash,
      },
    },
  });
}

