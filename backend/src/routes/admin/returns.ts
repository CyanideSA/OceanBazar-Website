import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import {
  listRefundsForReturn,
  findLatestRefundForReturn,
  createRefundRecord,
  updateRefundRecord,
} from '../../lib/refundRecords';

import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';
import { requireAdminReauth } from '../../middleware/adminReauth';
import { notifyCustomer } from '../../services/customerNotify';
import * as courierService from '../../services/courierService';
import type { AssignCourierInput } from '../../services/courierService';

const router = Router();

function pushTimeline(prev: unknown, status: string, adminId: string | number, note?: string) {
  const timeline = Array.isArray(prev) ? prev : [];
  timeline.push({ status, timestamp: new Date().toISOString(), actor: String(adminId), note });
  return timeline;
}

async function orderSummaries(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, unknown>();
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, total: true, createdAt: true, user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  return new Map(orders.map((o) => [o.id, o]));
}

// GET /api/admin/returns
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status, search } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  if (search) where.OR = [
    { order_id: { contains: search } },
    { user_id: { contains: search } },
    { id: { contains: search } },
  ];

  const [items, total] = await Promise.all([
    prisma.return_requests.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.return_requests.count({ where }),
  ]);

  const orderMap = await orderSummaries([...new Set(items.map((i) => i.order_id))]);
  const enriched = items.map((i) => ({ ...i, order: orderMap.get(i.order_id) || null }));

  res.json({ returns: enriched, total, page, limit });
});

// GET /api/admin/returns/:id
router.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!item) { res.status(404).json({ error: 'Return request not found' }); return; }

  const [order, refundRecords, courierShipments] = await Promise.all([
    prisma.order.findUnique({
      where: { id: item.order_id },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        shippingAddress: true,
        paymentTxs: true,
        shipments: true,
      },
    }),
    listRefundsForReturn(item.id),
    prisma.courier_shipments.findMany({ where: { order_id: item.order_id }, orderBy: { created_at: 'desc' } }),
  ]);

  res.json({ returnRequest: item, order, refundRecords, courierShipments });
});

// PATCH /api/admin/returns/:id — generic field update (kept for backward compatibility)
router.patch('/:id', async (req: Request, res: Response) => {
  const { status, admin_note, assigned_to_admin_id, refund_method, refund_amount, tracking_number, shipping_carrier } = req.body;
  const prev = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!prev) { res.status(404).json({ error: 'Not found' }); return; }

  const timeline = Array.isArray(prev.timeline) ? prev.timeline : [];
  if (status && status !== prev.status) {
    (timeline as any[]).push({ status, timestamp: new Date().toISOString(), actor: String(req.admin!.adminId) });
  }

  const updated = await prisma.return_requests.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(admin_note !== undefined && { admin_note }),
      ...(assigned_to_admin_id !== undefined && { assigned_to_admin_id }),
      ...(refund_method && { refund_method }),
      ...(refund_amount !== undefined && { refund_amount }),
      ...(tracking_number && { tracking_number }),
      ...(shipping_carrier && { shipping_carrier }),
      timeline,
      updated_at: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_RETURN', targetType: 'return_request', targetId: prev.id, details: { status, admin_note } },
  });

  res.json({ returnRequest: updated });
});

// PATCH /api/admin/returns/:id/status — alias
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status, note } = req.body;
  const prev = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!prev) { res.status(404).json({ error: 'Not found' }); return; }

  const timeline = pushTimeline(prev.timeline, status, req.admin!.adminId, note);

  const updated = await prisma.return_requests.update({
    where: { id: prev.id },
    data: { status, admin_note: note, timeline, updated_at: new Date() },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_RETURN_STATUS', targetType: 'return_request', targetId: prev.id, details: { status, note } },
  });

  res.json({ returnRequest: updated });
});

// ─── Status machine transitions ──────────────────────────────────────────────

// POST /api/admin/returns/:id/approve
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { note } = req.body as { note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (rr.status !== 'pending') { res.status(400).json({ error: `Cannot approve a return in status "${rr.status}"` }); return; }

  const timeline = pushTimeline(rr.timeline, 'approved', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'approved', admin_note: note ?? rr.admin_note, timeline, updated_at: new Date() },
  });

  const order = await prisma.order.findUnique({ where: { id: rr.order_id } });
  if (order) {
    try { await notifyCustomer({ userId: order.userId, event: 'return_initiated', vars: { orderNumber: order.orderNumber } }); } catch { /* non-fatal */ }
  }

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'APPROVE_RETURN', targetType: 'return_request', targetId: rr.id, details: { note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/reject
router.post('/:id/reject', async (req: Request, res: Response) => {
  const { note } = req.body as { note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (rr.status !== 'pending') { res.status(400).json({ error: `Cannot reject a return in status "${rr.status}"` }); return; }

  const timeline = pushTimeline(rr.timeline, 'rejected', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'rejected', admin_note: note ?? rr.admin_note, timeline, updated_at: new Date() },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'REJECT_RETURN', targetType: 'return_request', targetId: rr.id, details: { note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/courier — book a return courier pickup (live assign or manual tracking fallback)
router.post('/:id/courier', async (req: Request, res: Response) => {
  const { mode, courier, trackingNumber, carrier, note, recipientPhone, recipientAddress } = req.body as {
    mode: 'assign' | 'manual';
    courier?: AssignCourierInput['courier'];
    trackingNumber?: string;
    carrier?: string;
    note?: string;
    recipientPhone?: string;
    recipientAddress?: string;
  };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (rr.status !== 'approved') { res.status(400).json({ error: `Cannot book courier for a return in status "${rr.status}"` }); return; }

  const order = await prisma.order.findUnique({ where: { id: rr.order_id }, include: { shippingAddress: true, user: true } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let finalTrackingNumber: string | undefined;
  let finalCarrier: string | undefined;

  if (mode === 'assign' && courier) {
    const pickupAddress = recipientAddress || (order.shippingAddress
      ? [order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.city].filter(Boolean).join(', ')
      : '');
    const result = await courierService.assignCourier({
      orderId: order.id,
      courier,
      recipientName: order.user?.name || 'Warehouse Pickup',
      recipientPhone: recipientPhone || order.user?.phone || '',
      recipientAddress: pickupAddress,
      codAmount: 0,
      note: note || `Return pickup for return #${rr.id}`,
    });
    if (!result.success) { res.status(400).json({ error: result.message || 'Courier booking failed' }); return; }
    finalTrackingNumber = result.trackingCode || result.consignmentId;
    finalCarrier = courier;
    // Tag the shipment as a return pickup for traceability.
    if (result.courierShipmentId) {
      await prisma.courier_shipments.update({
        where: { id: result.courierShipmentId },
        data: { note: `RETURN:${rr.id} — ${note || 'Return pickup'}` },
      }).catch(() => {});
    }
  } else {
    if (!trackingNumber) { res.status(400).json({ error: 'trackingNumber is required for manual mode' }); return; }
    finalTrackingNumber = trackingNumber;
    finalCarrier = carrier || 'manual';
    await prisma.courier_shipments.create({
      data: {
        id: uuidv4(),
        order_id: order.id,
        courier_provider: finalCarrier.toLowerCase(),
        tracking_code: finalTrackingNumber,
        courier_status: 'booked',
        internal_status: 'in_transit',
        recipient_name: order.user?.name || null,
        recipient_phone: order.user?.phone || null,
        note: `RETURN:${rr.id} — ${note || 'Manual return pickup'}`,
      },
    });
  }

  const timeline = pushTimeline(rr.timeline, 'courier_booked', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: {
      status: 'courier_booked',
      tracking_number: finalTrackingNumber,
      shipping_carrier: finalCarrier,
      timeline,
      updated_at: new Date(),
    },
  });

  try {
    await notifyCustomer({
      userId: order.userId,
      event: 'return_initiated',
      vars: { orderNumber: order.orderNumber, trackingNumber: finalTrackingNumber || '' },
    });
  } catch { /* non-fatal */ }

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'BOOK_RETURN_COURIER', targetType: 'return_request', targetId: rr.id, details: { mode, trackingNumber: finalTrackingNumber, carrier: finalCarrier } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/received — mark received at warehouse
router.post('/:id/received', async (req: Request, res: Response) => {
  const { note } = req.body as { note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['approved', 'courier_booked'].includes(rr.status)) {
    res.status(400).json({ error: `Cannot mark received for a return in status "${rr.status}"` }); return;
  }

  const timeline = pushTimeline(rr.timeline, 'received', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'received', admin_note: note ?? rr.admin_note, timeline, updated_at: new Date() },
  });

  const order = await prisma.order.findUnique({ where: { id: rr.order_id } });
  if (order) {
    try { await notifyCustomer({ userId: order.userId, event: 'return_received', vars: { orderNumber: order.orderNumber } }); } catch { /* non-fatal */ }
  }

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'MARK_RETURN_RECEIVED', targetType: 'return_request', targetId: rr.id, details: { note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/under-review — inspection in progress
router.post('/:id/under-review', async (req: Request, res: Response) => {
  const { note } = req.body as { note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (rr.status !== 'received') { res.status(400).json({ error: `Cannot start review for a return in status "${rr.status}"` }); return; }

  const timeline = pushTimeline(rr.timeline, 'under_review', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'under_review', admin_note: note ?? rr.admin_note, timeline, updated_at: new Date() },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'RETURN_UNDER_REVIEW', targetType: 'return_request', targetId: rr.id, details: { note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/refund-eligible — inspection passed, ask customer for payment info
router.post('/:id/refund-eligible', async (req: Request, res: Response) => {
  const { refundAmount, note } = req.body as { refundAmount?: number; note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['received', 'under_review'].includes(rr.status)) {
    res.status(400).json({ error: `Cannot mark refund-eligible for a return in status "${rr.status}"` }); return;
  }

  const order = await prisma.order.findUnique({ where: { id: rr.order_id } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const amount = refundAmount ?? Number(rr.refund_amount) ?? Number(order.total);
  const timeline = pushTimeline(rr.timeline, 'refund_eligible', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'refund_eligible', refund_amount: amount, admin_note: note ?? rr.admin_note, timeline, updated_at: new Date() },
  });

  // Create a pending refund_records row so the customer has somewhere to attach their payout account.
  const existingRecord = await findLatestRefundForReturn(rr.id);
  if (!existingRecord) {
    await createRefundRecord({
      id: uuidv4(),
      order_id: rr.order_id,
      return_id: rr.id,
      user_id: rr.user_id,
      amount,
      status: 'pending_info',
      created_by: String(req.admin!.adminId),
    });
  } else {
    await updateRefundRecord(existingRecord.id, { amount, status: 'pending_info' });
  }

  try {
    await notifyCustomer({ userId: order.userId, event: 'refund_eligible', vars: { orderNumber: order.orderNumber } });
    await notifyCustomer({ userId: order.userId, event: 'refund_payment_info_request', vars: { orderNumber: order.orderNumber } });
  } catch { /* non-fatal */ }

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'RETURN_REFUND_ELIGIBLE', targetType: 'return_request', targetId: rr.id, details: { amount, note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/refund-confirm — admin confirms the refund was actually paid out
router.post('/:id/refund-confirm', requireAdminReauth(), async (req: Request, res: Response) => {
  const { amount, method, reference, notes } = req.body as { amount?: number; method?: string; reference?: string; notes?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['refund_eligible'].includes(rr.status)) {
    res.status(400).json({ error: `Cannot confirm refund for a return in status "${rr.status}"` }); return;
  }

  const order = await prisma.order.findUnique({ where: { id: rr.order_id } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const refundAmount = amount ?? Number(rr.refund_amount) ?? Number(order.total);

  const record = await findLatestRefundForReturn(rr.id);
  if (record) {
    await updateRefundRecord(record.id, {
      amount: refundAmount,
      method: method || record.method || 'bank_transfer',
      reference,
      notes,
      status: 'completed',
      completed_at: new Date(),
    });
  } else {
    await createRefundRecord({
      id: uuidv4(),
      order_id: rr.order_id,
      return_id: rr.id,
      user_id: rr.user_id,
      amount: refundAmount,
      method: method || 'bank_transfer',
      reference,
      notes,
      status: 'completed',
      completed_at: new Date(),
      created_by: String(req.admin!.adminId),
    });
  }

  const timeline = pushTimeline(rr.timeline, 'refunded', req.admin!.adminId, notes);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'refunded', refund_amount: refundAmount, refund_method: method || 'bank_transfer', timeline, updated_at: new Date() },
  });

  await prisma.order.update({ where: { id: rr.order_id }, data: { paymentStatus: 'refunded' } });

  try {
    await notifyCustomer({
      userId: order.userId,
      event: 'refund_completed',
      vars: { orderNumber: order.orderNumber, amount: String(refundAmount), method: method || 'bank_transfer', reference: reference || '' },
    });
  } catch { /* non-fatal */ }

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'CONFIRM_RETURN_REFUND', targetType: 'return_request', targetId: rr.id, details: { amount: refundAmount, method, reference } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/close
router.post('/:id/close', async (req: Request, res: Response) => {
  const { note } = req.body as { note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['rejected', 'refunded'].includes(rr.status)) {
    res.status(400).json({ error: `Cannot close a return in status "${rr.status}"` }); return;
  }

  const timeline = pushTimeline(rr.timeline, 'closed', req.admin!.adminId, note);
  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'closed', admin_note: note ?? rr.admin_note, timeline, updated_at: new Date() },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'CLOSE_RETURN', targetType: 'return_request', targetId: rr.id, details: { note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/refund — legacy one-shot refund (kept for backward compatibility)
router.post('/:id/refund', requireAdminReauth(), async (req: Request, res: Response) => {
  const { amount, method, note } = req.body as { amount: number; method?: string; note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'refunded', refund_amount: amount, refund_method: method || 'original_payment', admin_note: note, updated_at: new Date() },
  });

  await createRefundRecord({
    id: uuidv4(),
    order_id: rr.order_id,
    return_id: rr.id,
    user_id: rr.user_id,
    amount,
    method: method || 'original_payment',
    notes: note,
    status: 'completed',
    completed_at: new Date(),
    created_by: String(req.admin!.adminId),
  });

  // Update the order payment status
  await prisma.order.updateMany({
    where: { id: rr.order_id },
    data: { paymentStatus: 'refunded' },
  });

  const order = await prisma.order.findUnique({ where: { id: rr.order_id } });
  if (order) {
    try {
      await notifyCustomer({
        userId: order.userId,
        event: 'refund_completed',
        vars: { orderNumber: order.orderNumber, amount: String(amount), method: method || 'original_payment' },
      });
    } catch { /* non-fatal */ }
  }

  res.json({ returnRequest: updated, message: 'Refund processed' });
});

export default router;
