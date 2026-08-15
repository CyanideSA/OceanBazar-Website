import { prisma } from '../lib/prisma';

import { recordAdminAudit } from '../lib/adminAudit';
import type { Request } from 'express';
import { generateEntityId } from '../utils/hexId';
import * as ssl from './sslcommerzService';

function readMeta(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return { ...(metadata as Record<string, unknown>) };
}

export async function refundTransaction(
  req: Request,
  txId: string,
  amount?: number,
  note?: string,
) {
  const paymentTx = await prisma.paymentTransaction.findUnique({ where: { id: txId } });
  if (!paymentTx) {
    throw Object.assign(new Error('Transaction not found'), { status: 404 });
  }

  const refundAmount = amount || Number(paymentTx.amount);
  const meta = readMeta(paymentTx.metadata);
  let bankTranId = String(meta.bank_tran_id || meta.bankTranId || '').trim();
  let gatewayRefund: Record<string, unknown> | null = null;

  // SSLCommerz payments must refund through the gateway (never local-only).
  if (paymentTx.method === 'sslcommerz') {
    if (!(await ssl.isSslConfigured())) {
      throw Object.assign(new Error('SSLCommerz is not configured — cannot process gateway refund'), { status: 503 });
    }
    if (!bankTranId && paymentTx.providerTxId) {
      try {
        const validation = await ssl.validatePayment(String(paymentTx.providerTxId));
        bankTranId = String(validation.bankTranId || '').trim();
      } catch {
        /* fall through to missing bank id error */
      }
    }
    if (!bankTranId) {
      throw Object.assign(
        new Error('Missing SSLCommerz bank_tran_id on this transaction — cannot refund via gateway yet'),
        { status: 400 },
      );
    }
    const refundTransId = `RF${generateEntityId()}`.slice(0, 30);
    gatewayRefund = await ssl.initiateRefund({
      bankTranId,
      refundAmount,
      refundRemarks: note || 'Admin refund',
      refundTransId,
      refeId: paymentTx.id,
    });
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'ssl-refund',hypothesisId:'H-D',location:'paymentAdminService.ts:refund',message:'ssl refund initiated',data:{txId:paymentTx.id,refundAmount,status:gatewayRefund?.status||null,apiConnect:gatewayRefund?.APIConnect||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const status = String(gatewayRefund.status || '').toLowerCase();
    const apiConnect = String(gatewayRefund.APIConnect || '');
    if (apiConnect === 'FAILED' || apiConnect === 'INACTIVE' || apiConnect === 'INVALID_REQUEST') {
      throw Object.assign(
        new Error(`SSLCommerz refund auth failed (${apiConnect})`),
        { status: 502 },
      );
    }
    if (status === 'failed') {
      throw Object.assign(
        new Error(String(gatewayRefund.errorReason || 'SSLCommerz refund failed to initiate')),
        { status: 502 },
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentTransaction.update({
      where: { id: paymentTx.id },
      data: {
        status: 'refunded',
        metadata: {
          ...meta,
          refundNote: note || null,
          refundAmount,
          refundedAt: new Date().toISOString(),
          ...(gatewayRefund
            ? {
                sslRefund: gatewayRefund,
                refund_ref_id: gatewayRefund.refund_ref_id ?? null,
              }
            : {}),
        } as object,
      },
    });

    const purpose = String(meta.purpose || 'order_total');
    if (purpose === 'delivery_fee') {
      await tx.$executeRaw`
        UPDATE orders
        SET delivery_payment_status = 'refunded',
            delivery_fee_paid = 0
        WHERE id = ${paymentTx.orderId}
      `;
    } else {
      await tx.order.update({
        where: { id: paymentTx.orderId },
        data: { paymentStatus: 'refunded' },
      });
    }

    await recordAdminAudit(req, {
      action: 'REFUND_PAYMENT',
      targetType: 'payment_transaction',
      targetId: paymentTx.id,
      details: {
        amount: refundAmount,
        note,
        sslRefundRef: gatewayRefund?.refund_ref_id || null,
      },
    });
    return updated;
  });
}
