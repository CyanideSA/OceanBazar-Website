import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import {
  validateCheckoutWithCore,
  fulfillInventoryForOrder,
  toNumber,
} from '../clients/commerce-client';
import { getTier } from '../utils/obPoints';
import { generateEntityId, formatOrderNumber } from '../utils/hexId';
import { earnPoints, redeemPoints, getBalance } from '../services/obPointsService';
import { routeParam } from '../utils/params';
import { emitAdminEvent } from '../lib/adminEvents';
import { publishDomainEvent } from '../events/publisher';
import { COD_FEE } from '../utils/codRules';
import { appLog } from '../lib/appLog';
import { v4 as uuidv4 } from 'uuid';
import { notifyCustomer } from '../services/customerNotify';

/** Orders may be cancelled for free within this window; after that (if paid) a return request is required. */
const FREE_CANCEL_WINDOW_HOURS = 12;
const PAID_STATUSES = ['paid', 'under_verification', 'pending_verification'];

const router = Router();

router.use(requireAuth);

// POST /api/orders/place
router.post('/place', async (req: Request, res: Response) => {
  const {
    shippingAddressId,
    paymentMethod,
    couponCode,
    couponId,
    obPointsToRedeem = 0,
    notes,
  } = req.body as {
    shippingAddressId: number;
    paymentMethod: string;
    couponCode?: string;
    couponId?: number;
    obPointsToRedeem?: number;
    notes?: string;
  };

  if (shippingAddressId == null || !Number.isFinite(Number(shippingAddressId))) {
    res.status(400).json({ error: 'Shipping address is required' });
    return;
  }

  // ── Load cart ────────────────────────────────────────────────────────────
  const cart = await prisma.cart.findUnique({
    where: { userId: req.user!.userId },
    include: {
      items: {
        include: {
          product: { include: { pricing: true } },
          variant: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    res.status(400).json({ error: 'Cart is empty' });
    return;
  }

  // ── Load address (needed for COD district check) ─────────────────────────
  const address = await prisma.savedAddress.findFirst({
    where: { id: Number(shippingAddressId), userId: req.user!.userId },
  });
  if (!address) {
    res.status(400).json({ error: 'Shipping address not found' });
    return;
  }

  let resolvedCouponId: number | null = null;
  if (couponCode || couponId) {
    const coupon = couponCode
      ? await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
      : couponId
        ? await prisma.coupon.findUnique({ where: { id: couponId } })
        : null;
    if (coupon) resolvedCouponId = coupon.id;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
  const obBalance = await getBalance(req.user!.userId);

  // ── Authoritative pricing / MOQ / stock / COD via Java core ─────────────
  let coreValidation;
  try {
    coreValidation = await validateCheckoutWithCore(req, {
      paymentMethod,
      couponCode: couponCode?.trim().toUpperCase(),
      obPointsToRedeem,
      obBalance,
      shippingAddressId,
    });
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: unknown } };
    res.status(ax.response?.status || 502).json(ax.response?.data ?? { error: 'Checkout validation unavailable' });
    return;
  }

  if (!coreValidation.valid) {
    res.status(400).json({ errors: coreValidation.errors });
    return;
  }

  const result = {
    totals: {
      subtotal: toNumber(coreValidation.totals?.subtotal ?? 0),
      discount: toNumber(coreValidation.totals?.discount ?? 0),
      gst: toNumber(coreValidation.totals?.gst ?? 0),
      shippingFee: toNumber(coreValidation.totals?.shippingFee ?? 0),
      serviceFee: toNumber(coreValidation.totals?.serviceFee ?? 0),
      obDiscount: toNumber(coreValidation.totals?.obDiscount ?? coreValidation.obDiscount ?? 0),
      total: toNumber(coreValidation.totals?.total ?? 0),
    },
    obPointsEarned: coreValidation.obPointsEarned ?? 0,
    codAllowed: coreValidation.codAllowed ?? true,
  };

  const codFeeAmount = paymentMethod === 'cod' ? COD_FEE : 0;
  const finalTotal = result.totals.total + codFeeAmount;

  // ── Persist OB redemption ───────────────────────────────────────────────
  let obDiscount = 0;
  if (obPointsToRedeem > 0) {
    const rd = await redeemPoints(req.user!.userId, obPointsToRedeem);
    obDiscount = rd.bdtValue;
  }

  // ── Snapshot product images onto order items (primary asset, else first) ──
  const lineProductIds = [...new Set(coreValidation.lines.map((l) => l.productId))];
  const productAssets = lineProductIds.length
    ? await prisma.productAsset.findMany({
        where: { productId: { in: lineProductIds }, assetType: 'image' },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      })
    : [];
  const imageByProductId = new Map<string, string>();
  for (const asset of productAssets) {
    if (!imageByProductId.has(asset.productId)) imageByProductId.set(asset.productId, asset.url);
  }

  // Omit productImage from Prisma create — Docker @prisma/client may lag schema.
  // Snapshot images via raw SQL after create (column exists on order_items).
  const orderItems = coreValidation.lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId ?? undefined,
    productTitle: line.productTitle,
    unitPrice: toNumber(line.unitPrice),
    quantity: line.quantity,
    lineTotal: toNumber(line.lineTotal),
    discountPct: toNumber(line.discountPct ?? 0),
  }));

  const orderId = generateEntityId();
  // ── Persist order/coupon/stock/cart atomically ──────────────────────────
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      if (resolvedCouponId) {
        await tx.coupon.update({
          where: { id: resolvedCouponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          id: orderId,
          orderNumber: formatOrderNumber(orderId),
          userId: req.user!.userId,
          customerType: req.user!.userType,
          subtotal: result.totals.subtotal,
          discount: result.totals.discount,
          gst: result.totals.gst,
          shippingFee: result.totals.shippingFee,
          serviceFee: result.totals.serviceFee,
          obPointsUsed: obPointsToRedeem,
          obDiscount: result.totals.obDiscount,
          couponId: resolvedCouponId,
          total: finalTotal,
          paymentMethod: paymentMethod as
            | 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'sslcommerz' | 'installment',
          shippingAddressId,
          notes,
          ...(codFeeAmount > 0 ? { codFee: codFeeAmount } : {}),
          items: { create: orderItems },
          timeline: {
            create: {
              status: 'pending',
              note: 'Order placed',
              actorType: 'customer',
              actorId: req.user!.userId,
            },
          },
        },
        include: { items: true, timeline: true },
      });

      for (const item of createdOrder.items) {
        const url = imageByProductId.get(item.productId);
        if (!url) continue;
        await tx.$executeRaw`
          UPDATE order_items SET product_image = ${url} WHERE id = ${item.id}
        `;
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return createdOrder;
    });
  } catch (persistErr) {
    throw persistErr;
  }

  try {
    await fulfillInventoryForOrder(
      req,
      order.id,
      order.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity: i.quantity,
      }))
    );
  } catch (invErr) {
    appLog('error', 'inventory_fulfill_failed', {
      orderId: order.id,
      detail: invErr instanceof Error ? invErr.message : String(invErr),
    });
  }

  // ── Send confirmation email + SMS + WhatsApp ──────────────────────────────
  try {
    const { sendOrderConfirmation } = await import('../services/emailService');
    const { sendOrderConfirmationSms, sendOrderConfirmationWhatsApp } = await import('../services/smsService');
    if (user.email) sendOrderConfirmation(user.email, { orderNumber: order.orderNumber, total: Number(order.total), items: order.items.map(i => ({ productTitle: i.productTitle, quantity: i.quantity, unitPrice: Number(i.unitPrice) })) }).catch(() => {});
    if (user.phone) {
      sendOrderConfirmationSms(user.phone, order.orderNumber).catch(() => {});
      sendOrderConfirmationWhatsApp(user.phone, order.orderNumber, Number(order.total), order.items.map(i => ({ productTitle: i.productTitle, quantity: i.quantity }))).catch(() => {});
    }
  } catch { /* non-fatal */ }

  // ── OB points: earn + tier upgrade ──────────────────────────────────────
  const onlineMethods = ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'];
  const needsOnlinePayment = onlineMethods.includes(paymentMethod);

  let pointsEarned = 0;
  let tierUpgrade: string | null = null;
  if (paymentMethod === 'cod') {
    const ep = await earnPoints(req.user!.userId, orderId, result.totals.total);
    pointsEarned = ep.pointsEarned;
    tierUpgrade = ep.tierUpgrade.upgrades ? ep.tierUpgrade.to : null;
  } else {
    pointsEarned = result.obPointsEarned;
  }

  // Notify admin CRM of new order
  try { emitAdminEvent('admin:order:new', { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total), userId: req.user!.userId }); } catch { /* non-fatal */ }
  try {
    const { alertNewOrder } = await import('../services/teamsService');
    alertNewOrder(order.orderNumber, Number(order.total), user.name).catch(() => {});
  } catch { /* non-fatal */ }

  void publishDomainEvent('OrderPlaced', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    paymentMethod,
  }, { aggregateId: order.id, userId: req.user!.userId });

  res.status(201).json({
    order,
    requiresPayment: needsOnlinePayment,
    pointsEarned,
    tierUpgrade,
    codAllowed: result.codAllowed,
  });
});

// POST /api/orders/track-public — no auth required
router.post('/track-public', async (req: Request, res: Response) => {
  const { orderNumber, phone } = req.body as { orderNumber: string; phone: string };
  if (!orderNumber || !phone) { res.status(400).json({ error: 'orderNumber and phone required' }); return; }
  const order = await prisma.order.findFirst({
    where: { orderNumber, user: { phone } },
    include: {
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: { select: { carrier: true, trackingNumber: true, estimatedDelivery: true, status: true } },
      items: { select: { productTitle: true, quantity: true, unitPrice: true } },
    },
  });
  if (!order) { res.status(404).json({ error: 'Order not found. Check order number and phone.' }); return; }
  res.json({
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    total: Number(order.total),
    items: order.items,
    timeline: order.timeline,
    shipments: order.shipments,
  });
});

// GET /api/orders
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 10;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { userId: req.user!.userId } }),
  ]);

  res.json({ orders, total, page, limit });
});

// GET /api/orders/:id/tracking
router.get('/:id/tracking', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.userId },
    include: { timeline: { orderBy: { createdAt: 'asc' } }, shipments: true },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  res.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber,
    timeline: order.timeline,
    shipments: order.shipments,
  });
});

// GET /api/orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const requesterId = req.user!.userId;
  const order = await prisma.order.findFirst({
    where: { id, userId: requesterId },
    include: {
      items: true,
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: true,
      shippingAddress: true,
    },
  });
  if (!order) {
    // Distinguish stale-session ownership mismatches from genuinely missing orders.
    const ownedByOther = await prisma.order.findFirst({ where: { id }, select: { userId: true } });
    res.status(404).json({
      error: 'Order not found',
      code: ownedByOther && ownedByOther.userId !== requesterId ? 'ORDER_OWNER_MISMATCH' : 'ORDER_NOT_FOUND',
    });
    return;
  }
  res.json({ order });
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.userId },
    include: { items: true },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
    res.status(400).json({ error: 'Order cannot be cancelled at this stage' }); return;
  }

  const hoursSinceOrder = (Date.now() - order.createdAt.getTime()) / (60 * 60 * 1000);
  const isPaid = PAID_STATUSES.includes(order.paymentStatus);

  // Paid orders older than the free-cancel window must go through the return/refund flow.
  if (isPaid && hoursSinceOrder > FREE_CANCEL_WINDOW_HOURS) {
    res.status(400).json({
      error: 'This order was paid more than 12 hours ago. Please submit a return request to cancel it.',
      code: 'CANCEL_WINDOW_EXPIRED',
    });
    return;
  }

  // Paid orders within the window still require admin review — create a return/cancellation request.
  if (isPaid) {
    const existing = await prisma.return_requests.findFirst({
      where: { order_id: order.id, user_id: req.user!.userId },
    });
    if (existing) {
      res.status(409).json({
        error: 'A cancellation request for this order already exists',
        returnRequest: existing,
      });
      return;
    }

    const returnReq = await prisma.return_requests.create({
      data: {
        id: uuidv4(),
        order_id: order.id,
        user_id: req.user!.userId,
        reason: 'cancel',
        reason_category: 'order_cancellation',
        description: 'Customer requested cancellation after payment was received.',
        items: JSON.stringify(order.items.map((i) => ({
          productId: i.productId,
          title: i.productTitle,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        }))),
        status: 'pending',
        timeline: JSON.stringify([{ status: 'pending', timestamp: new Date().toISOString(), actor: 'customer', note: 'Cancellation requested' }]),
      },
    });

    res.status(202).json({
      message: 'Your order is already paid — a cancellation request has been created and is awaiting admin review.',
      code: 'CANCEL_CONVERTED_TO_RETURN',
      returnRequest: returnReq,
    });
    return;
  }

  // Unpaid orders within stage — free cancel.
  await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
  await prisma.orderTimeline.create({
    data: { orderId: order.id, status: 'cancelled', note: 'Cancelled by customer', actorType: 'customer', actorId: req.user!.userId },
  });
  // Restore stock
  await Promise.all(
    order.items.map(async (item) => {
      try {
        await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        if (item.variantId) {
          await prisma.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        }
      } catch { /* non-fatal */ }
    })
  );
  try {
    await notifyCustomer({ userId: req.user!.userId, event: 'order_cancelled', vars: { orderNumber: order.orderNumber } });
  } catch { /* non-fatal */ }
  res.json({ message: 'Order cancelled' });
});

// POST /api/orders/:id/reorder — re-add all items from a past order to cart
router.post('/:id/reorder', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const userId = req.user!.userId;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: { include: { product: { include: { pricing: true } } } } },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) { cart = await prisma.cart.create({ data: { userId } }); }

  const userType = req.user!.userType as string;
  let addedCount = 0;

  for (const item of order.items) {
    if (item.product.stock <= 0) continue;
    const pricing = item.product.pricing.find((p) => p.customerType === userType)
      ?? item.product.pricing.find((p) => p.customerType === 'retail');
    if (!pricing) continue;
    const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId: item.productId, variantId: item.variantId } });
    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: { increment: item.quantity } } });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitPrice: pricing.price, customerType: userType as any },
      });
    }
    addedCount++;
  }

  res.json({ message: `${addedCount} item(s) added to cart`, addedCount });
});

export default router;
