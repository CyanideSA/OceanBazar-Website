import { PrismaClient } from '@prisma/client';
import { recordAdminAudit } from '../lib/adminAudit';
import type { Request } from 'express';

const prisma = new PrismaClient();

export async function refundTransaction(
  req: Request,
  txId: string,
  amount?: number,
  note?: string,
) {
  return prisma.$transaction(async (tx) => {
    const paymentTx = await tx.paymentTransaction.findUnique({ where: { id: txId } });
    if (!paymentTx) {
      throw Object.assign(new Error('Transaction not found'), { status: 404 });
    }

    const refundAmount = amount || Number(paymentTx.amount);
    const updated = await tx.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: {
        status: 'refunded',
        metadata: {
          ...(paymentTx.metadata as object || {}),
          refundNote: note,
          refundAmount,
          refundedAt: new Date().toISOString(),
        },
      },
    });

    await tx.order.update({
      where: { id: paymentTx.orderId },
      data: { paymentStatus: 'refunded' },
    });

    await recordAdminAudit(req, {
      action: 'REFUND_PAYMENT',
      targetType: 'payment_transaction',
      targetId: paymentTx.id,
      details: { amount: refundAmount, note },
    });
    return updated;
  });
}

