import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { buildOrderLinesFromCart } from '../utils/lineItemPricing';
import { validateCheckout, type CheckoutLineItem } from '../utils/checkoutValidation';
import { toPricingRow, applyVariantOverride } from '../utils/lineItemPricing';
import { type CouponData } from '../utils/couponRules';
import { getTier } from '../utils/obPoints';
import { generateEntityId, formatOrderNumber } from '../utils/hexId';
import { earnPoints, redeemPoints, getBalance } from '../services/obPointsService';
import { routeParam } from '../utils/params';

const router = Router();
const prisma = new PrismaClient();

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
    where: { id: shippingAddressId, userId: req.user!.userId },
  });
  if (!address) {
    res.status(400).json({ error: 'Shipping address not found' });
    return;
  }

  // ── Resolve coupon ───────────────────────────────────────────────────────
  let couponData: CouponData | null = null;
  let resolvedCouponId: number | null = null;

  if (couponCode || couponId) {
    const coupon = couponCode
      ? await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
      : couponId
        ? await prisma.coupon.findUnique({ where: { id: couponId } })
        : null;

    if (coupon) {
      resolvedCouponId = coupon.id;
      couponData = {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type as 'percent' | 'fixed' | 'free_shipping',
        value: Number(coupon.value),
        minOrder: Number(coupon.minOrder),
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        startsAt: coupon.startsAt,
        expiresAt: coupon.expiresAt,
        active: coupon.active,
      };
    }
  }

  // ── Load user + OB balance ──────────────────────────────────────────────
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
  const obBalance = await getBalance(req.user!.userId);
  const obTier = getTier(Number(user.lifetimeSpend));
  const lifetimeSpend = Number(user.lifetimeSpend);

  // ── Pending COD count ───────────────────────────────────────────────────
  const pendingCodCount = await prisma.order.count({
    where: {
      userId: req.user!.userId,
      paymentMethod: 'cod',
      status: { in: ['pending', 'confirmed', 'processing'] },
    },
  });

  // ── Build checkout line items ───────────────────────────────────────────
  const checkoutItems: CheckoutLineItem[] = cart.items.map((item) => {
    const retail = item.product.pricing.find((p) => p.customerType === 'retail');
    const wholesale = item.product.pricing.find((p) => p.customerType === 'wholesale');
    const ov = item.variant?.price_override;
    const retailRow = applyVariantOverride(toPricingRow(retail), ov);
    const wholesaleRow = applyVariantOverride(toPricingRow(wholesale), ov);

    return {
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      productTitle: item.product.titleEn,
      quantity: item.quantity,
      stock: item.variant?.stock ?? item.product.stock,
      moq: item.product.moq,
      pricing: {
        retail: retailRow ?? { price: 0 },
        wholesale: wholesaleRow,
      },
    };
  });

  // ── Validate everything ─────────────────────────────────────────────────
  const result = validateCheckout({
    userType: req.user!.userType,
    items: checkoutItems,
    paymentMethod,
    coupon: couponData,
    obPointsToRedeem,
    obBalance,
    obTier,
    lifetimeSpend,
    codContext: {
      orderTotal: 0, // overridden inside validateCheckout
      pendingCodCount,
      codAbuse: false, // future: read from user flags
      district: address.district,
    },
  });

  if (!result.valid) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  // ── Persist OB redemption ───────────────────────────────────────────────
  let obDiscount = 0;
  if (obPointsToRedeem > 0) {
    const rd = await redeemPoints(req.user!.userId, obPointsToRedeem);
    obDiscount = rd.bdtValue;
  }

  // ── Persist coupon usage ────────────────────────────────────────────────
  if (resolvedCouponId) {
    await prisma.coupon.update({
      where: { id: resolvedCouponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  // ── Build order lines ───────────────────────────────────────────────────
  const orderItems = buildOrderLinesFromCart(cart.items, req.user!.userType);

  // ── Create order ────────────────────────────────────────────────────────
  const orderId = generateEntityId();
  const order = await prisma.order.create({
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
      total: result.totals.total,
      paymentMethod: paymentMethod as
        | 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'sslcommerz' | 'installment',
      shippingAddressId,
      notes,
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

  // ── Clear cart ──────────────────────────────────────────────────────────
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  // ── Send confirmation email + SMS ─────────────────────────────────
  try {
    const { sendOrderConfirmation } = await import('../services/emailService');
    const { sendOrderConfirmationSms } = await import('../services/smsService');
    if (user.email) sendOrderConfirmation(user.email, { orderNumber: order.orderNumber, total: Number(order.total), items: order.items.map(i => ({ productTitle: i.productTitle, quantity: i.quantity, unitPrice: Number(i.unitPrice) })) }).catch(() => {});
    if (user.phone) sendOrderConfirmationSms(user.phone, order.orderNumber).catch(() => {});
  } catch { /* non-fatal */ }

  // ── OB points: earn + tier upgrade ──────────────────────────────────────
  const onlineMethods = ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'];
  const needsOnlinePayment = onlineMethods.includes(paymentMethod);

  let pointsEarned = 0;
  let tierUpgrade = result.tierUpgrade;
  if (paymentMethod === 'cod') {
    const ep = await earnPoints(req.user!.userId, orderId, result.totals.total);
    pointsEarned = ep.pointsEarned;
    tierUpgrade = ep.tierUpgrade;
  }

  res.status(201).json({
    order,
    requiresPayment: needsOnlinePayment,
    pointsEarned,
    tierUpgrade,
    codAllowed: result.codAllowed,
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
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.userId },
    include: {
      items: true,
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: true,
      shippingAddress: true,
    },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  res.json({ order });
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.userId },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  if (!['pending', 'confirmed'].includes(order.status)) {
    res.status(400).json({ error: 'Order cannot be cancelled at this stage' }); return;
  }
  await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
  await prisma.orderTimeline.create({
    data: { orderId: order.id, status: 'cancelled', note: 'Cancelled by customer', actorType: 'customer', actorId: req.user!.userId },
  });
  res.json({ message: 'Order cancelled' });
});

export default router;
