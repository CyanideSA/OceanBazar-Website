import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';

/** Docker images may ship an older Prisma client without the refund_records delegate. */
function refundDb() {
  return (prisma as any).refund_records;
}

export async function listRefundsForReturn(returnId: string) {
  const db = refundDb();
  if (db?.findMany) {
    return db.findMany({ where: { return_id: returnId }, orderBy: { requested_at: 'desc' } });
  }
  return prisma.$queryRaw`
    SELECT * FROM refund_records WHERE return_id = ${returnId} ORDER BY requested_at DESC
  `;
}

export async function findLatestRefundForReturn(returnId: string) {
  const db = refundDb();
  if (db?.findFirst) {
    return db.findFirst({ where: { return_id: returnId }, orderBy: { requested_at: 'desc' } });
  }
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM refund_records WHERE return_id = ${returnId} ORDER BY requested_at DESC LIMIT 1
  `;
  return rows[0] || null;
}

export async function createRefundRecord(data: Record<string, unknown>) {
  const db = refundDb();
  if (db?.create) return db.create({ data: data as any });
  const id = String(data.id || uuidv4());
  await prisma.$executeRaw`
    INSERT INTO refund_records (
      id, order_id, return_id, payment_tx_id, user_id, amount, method, reference,
      customer_account, notes, receipt_url, status, requested_at, completed_at, created_by, updated_at
    ) VALUES (
      ${id},
      ${String(data.order_id)},
      ${data.return_id ?? null},
      ${data.payment_tx_id ?? null},
      ${String(data.user_id)},
      ${data.amount as any},
      ${data.method ?? null},
      ${data.reference ?? null},
      ${data.customer_account != null ? JSON.stringify(data.customer_account) : null}::jsonb,
      ${data.notes ?? null},
      ${data.receipt_url ?? null},
      ${String(data.status || 'pending_info')},
      NOW(),
      ${data.completed_at ?? null},
      ${data.created_by ?? null},
      NOW()
    )
  `;
  return { id, ...data };
}

export async function updateRefundRecord(id: string, data: Record<string, unknown>) {
  const db = refundDb();
  if (db?.update) return db.update({ where: { id }, data: data as any });

  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'customer_account' && v != null && typeof v === 'object') {
      cols.push(`${k} = $${cols.length + 1}::jsonb`);
      vals.push(JSON.stringify(v));
    } else {
      cols.push(`${k} = $${cols.length + 1}`);
      vals.push(v);
    }
  }
  cols.push('updated_at = NOW()');
  vals.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE refund_records SET ${cols.join(', ')} WHERE id = $${vals.length}`,
    ...vals,
  );
  return { id, ...data };
}
