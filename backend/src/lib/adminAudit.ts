import crypto from 'crypto';
import type { Request } from 'express';
import { prisma } from './prisma';

const HASH_KEY = 'admin_audit_chain_v1';

/** Match audit_logs column limits (see prisma AuditLog + live DB). */
const LIMITS = { action: 255, targetType: 100, targetId: 50 } as const;

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

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

  const action = clip(String(opts.action || ''), LIMITS.action);
  const targetType = clip(String(opts.targetType || ''), LIMITS.targetType);
  const targetIdRaw = String(opts.targetId || '');
  const targetId = clip(targetIdRaw, LIMITS.targetId);

  try {
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
      fullTargetId: targetIdRaw.length > LIMITS.targetId ? targetIdRaw : undefined,
      ...opts.details,
    };
    const chainSource = `${HASH_KEY}|${prevHash}|${action}|${targetType}|${targetId}|${stableStringify(body)}`;
    const chainHash = crypto.createHash('sha256').update(chainSource).digest('hex');

    await prisma.auditLog.create({
      data: {
        adminId: req.admin.adminId,
        action,
        targetType,
        targetId,
        details: {
          ...body,
          prevHash,
          chainHash,
        },
      },
    });

  } catch (err) {
    console.warn('[adminAudit] failed to record:', err instanceof Error ? err.message : err);
  }
}
