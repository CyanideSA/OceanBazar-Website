import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import {
  validateCheckoutWithCore,
  toNumber,
} from '../clients/commerce-client';
import { generateEntityId, formatOrderNumber } from '../utils/hexId';
import { earnPoints, redeemPoints, getBalance } from '../services/obPointsService';
import { routeParam } from '../utils/params';
import { emitAdminEvent } from '../lib/adminEvents';
import { publishDomainEvent } from '../events/publisher';
import { COD_FEE } from '../utils/codRules';
import { COD_LIMIT, type OrderTotals } from '../utils/pricing';
import { attachVariantLabels } from '../utils/variantLabel';
import { appLog } from '../lib/appLog';
import { v4 as uuidv4 } from 'uuid';
import { notifyCustomer } from '../services/customerNotify';
import { estimateCartWeightKg, quotePathaoDelivery } from '../services/deliveryQuoteService';
import { validateCheckout } from '../utils/checkoutValidation';
import { toPricingRow, applyVariantOverride } from '../utils/lineItemPricing';
import {
  findOrCreateGuestCustomer,
  normalizeEmail,
  normalizePhone,
  sendGuestBenefitsEmail,
} from '../services/guestCustomerService';
import * as ssl from '../services/sslcommerzService';

/** Orders may be cancelled for free within this window; after that (if paid) a return request is required. */
const FREE_CANCEL_WINDOW_HOURS = 12;
const PAID_STATUSES = ['paid', 'under_verification', 'pending_verification'];

function isPoliciesAgreed(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'on' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

const router = Router();

// POST /api/orders/place-guest — public guest checkout (no JWT)
router.post('/place-guest', async (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    paymentMethod,
    policiesAgreed,
    notes,
    shippingAddress,
    items: rawItems,
  } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    paymentMethod?: string;
    policiesAgreed?: unknown;
    notes?: string;
    shippingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      district?: string;
      postalCode?: string;
      pathaoCityId?: number;
      pathaoZoneId?: number;
      pathaoAreaId?: number;
      pathaoCityName?: string;
      pathaoZoneName?: string;
      pathaoAreaName?: string;
    };
    items?: Array<{ productId: string; quantity: number; variantId?: string }>;
  };

  const method = String(paymentMethod || '').toLowerCase();
  const onlineMethods = ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'];

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    res.status(400).json({ error: 'Name, email, and phone are required' });
    return;
  }
  if (!method || !['cod', 'sslcommerz', ...onlineMethods].includes(method)) {
    res.status(400).json({ error: 'Invalid payment method' });
    return;
  }
  if (!isPoliciesAgreed(policiesAgreed)) {
    res.status(400).json({
      error: 'Please agree to the Terms & Conditions, Privacy Policy, Return Policy, Refund Policy & Shipping Policy before placing your order.',
    });
    return;
  }
  if (!shippingAddress?.line1?.trim() || !shippingAddress?.city?.trim() || !shippingAddress?.district?.trim()) {
    res.status(400).json({ error: 'Shipping address (line1, city, district) is required' });
    return;
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    res.status(400).json({ error: 'Cart is empty' });
    return;
  }

  let guestUser;
  try {
    guestUser = await findOrCreateGuestCustomer({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Could not create guest customer' });
    return;
  }

  // Guests always price as retail (even if contact matched an existing wholesale account,
  // guest checkout path still uses retail pricing per product rules).
  const pricingType: 'retail' = 'retail';

  const productIds = [...new Set(rawItems.map((i) => String(i.productId)))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { pricing: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const variantIds = rawItems.map((i) => i.variantId).filter(Boolean) as string[];
  const variants = variantIds.length
    ? await prisma.product_variants_legacy.findMany({ where: { id: { in: variantIds } } })
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const checkoutItems = [];
  for (const line of rawItems) {
    const product = productById.get(String(line.productId));
    if (!product) {
      res.status(400).json({ error: `Product not found: ${line.productId}` });
      return;
    }
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 0));
    const variant = line.variantId ? variantById.get(line.variantId) : null;
    const retailRow = product.pricing.find((p) => p.customerType === 'retail');
    const wholesaleRow = product.pricing.find((p) => p.customerType === 'wholesale');
    const ov = variant?.price_override;
    const retail = applyVariantOverride(toPricingRow(retailRow ?? undefined), ov);
    const wholesale = applyVariantOverride(toPricingRow(wholesaleRow ?? undefined), ov);
    if (!retail) {
      res.status(400).json({ error: `No retail pricing for ${product.titleEn}` });
      return;
    }
    checkoutItems.push({
      productId: product.id,
      variantId: line.variantId || undefined,
      productTitle: product.titleEn,
      quantity: qty,
      stock: product.stock,
      moq: product.moq,
      pricing: { retail, wholesale },
    });
  }

  const taxPolicy = await (async () => {
    try {
      const { getActiveTaxPolicy } = await import('../services/taxVatSystem');
      return await getActiveTaxPolicy();
    } catch {
      return null;
    }
  })();

  const validation = validateCheckout({
    userType: pricingType,
    items: checkoutItems,
    paymentMethod: method,
    coupon: null,
    obPointsToRedeem: 0,
    obBalance: 0,
    obTier: 'Bronze',
    lifetimeSpend: 0,
    codContext: {
      orderTotal: 0,
      pendingCodCount: 0,
      codAbuse: false,
      district: shippingAddress.district,
    },
    taxPolicy: taxPolicy
      ? { vatRate: taxPolicy.vatRate, priceInclusive: taxPolicy.priceInclusive }
      : null,
  });

  if (!validation.valid) {
    res.status(400).json({ errors: validation.errors });
    return;
  }

  const pathaoCityId = Number(shippingAddress.pathaoCityId) || 0;
  const pathaoZoneId = Number(shippingAddress.pathaoZoneId) || 0;
  const waiveShipping = Boolean(validation.freeShipping);
  let shippingFee = waiveShipping ? 0 : validation.totals.shippingFee;
  if (!waiveShipping && pathaoCityId && pathaoZoneId) {
    try {
      const quote = await quotePathaoDelivery({
        pathaoCityId,
        pathaoZoneId,
        itemWeightKg: estimateCartWeightKg(validation.lines.reduce((n, l) => n + (l.quantity || 1), 0)),
      });
      shippingFee = quote.price;
    } catch (quoteErr) {
      appLog('warn', 'pathao_quote_on_place_guest_failed', {
        detail: quoteErr instanceof Error ? quoteErr.message : String(quoteErr),
      });
    }
  }

  const codFeeAmount = method === 'cod' ? COD_FEE : 0;
  const baseWithoutShipping = validation.totals.total - validation.totals.shippingFee;
  const finalTotal = Math.max(0, baseWithoutShipping + shippingFee + codFeeAmount);


  if (method === 'cod' && finalTotal > COD_LIMIT) {
    res.status(400).json({
      error: `COD is available for orders up to ৳${COD_LIMIT}. Your total is ৳${finalTotal}.`,
    });
    return;
  }

  const savedAddress = await prisma.savedAddress.create({
    data: {
      userId: guestUser.id,
      label: 'Guest',
      line1: shippingAddress.line1.trim(),
      line2: shippingAddress.line2?.trim() || null,
      city: shippingAddress.city.trim(),
      district: shippingAddress.district.trim(),
      postalCode: shippingAddress.postalCode?.trim() || null,
      isDefault: false,
      pathaoCityId: pathaoCityId || null,
      pathaoZoneId: pathaoZoneId || null,
      pathaoAreaId: Number(shippingAddress.pathaoAreaId) || null,
      pathaoCityName: shippingAddress.pathaoCityName || shippingAddress.city,
      pathaoZoneName: shippingAddress.pathaoZoneName || shippingAddress.district,
      pathaoAreaName: shippingAddress.pathaoAreaName || null,
    },
  });

  const lineProductIds = [...new Set(validation.lines.map((l) => l.productId))];
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

  const orderItems = validation.lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId ?? undefined,
    productTitle: line.productTitle,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    lineTotal: line.lineTotal,
    discountPct: line.discountPct,
  }));

  const orderId = generateEntityId();
  const needsOnlinePayment = onlineMethods.includes(method);

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          id: orderId,
          orderNumber: formatOrderNumber(orderId),
          userId: guestUser.id,
          customerType: 'retail',
          subtotal: validation.totals.subtotal,
          discount: validation.totals.discount,
          gst: validation.totals.gst,
          shippingFee,
          serviceFee: validation.totals.serviceFee,
          obPointsUsed: 0,
          obDiscount: 0,
          couponId: null,
          total: finalTotal,
          paymentMethod: method as
            | 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'sslcommerz' | 'installment',
          shippingAddressId: savedAddress.id,
          notes,
          codFee: codFeeAmount,
          deliveryPaymentStatus: 'none',
          deliveryFeePaid: 0,
          items: { create: orderItems },
          timeline: {
            create: {
              status: 'pending',
              note: method === 'cod'
                ? 'Guest order placed — pay when the order arrives'
                : 'Guest order placed',
              actorType: 'customer',
              actorId: guestUser.id,
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
      return createdOrder;
    });
  } catch (persistErr) {
    appLog('error', 'guest_order_persist_failed', {
      paymentMethod: method,
      detail: persistErr instanceof Error ? persistErr.message : String(persistErr),
    });
    throw persistErr;
  }

  try {
    const { extractMetaAttributionFromRequest, storeMetaAttributionForOrder } = await import('../lib/metaAttribution');
    await storeMetaAttributionForOrder(order.id, extractMetaAttributionFromRequest(req));
  } catch { /* non-fatal */ }

  try {
    const {
      getActiveTaxPolicy,
      calculateGatewayFee,
      getActiveGatewayFeePolicy,
      buildOrderTaxSnapshot,
      persistOrderTaxSnapshot,
    } = await import('../services/taxVatSystem');
    const policy = taxPolicy || (await getActiveTaxPolicy());
    const feePolicy = await getActiveGatewayFeePolicy();
    const gatewayPreview = calculateGatewayFee(finalTotal, feePolicy);
    const snapshot = buildOrderTaxSnapshot({
      totals: {
        ...validation.totals,
        shippingFee,
        total: finalTotal,
      },
      policy,
      gateway: gatewayPreview,
    });
    await persistOrderTaxSnapshot(order.id, snapshot);
  } catch { /* non-fatal tax snapshot */ }

  try {
    const { deductInventoryForPlacedOrder } = await import('../services/inventoryStockSync');
    await deductInventoryForPlacedOrder(
      order.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity: i.quantity,
      })),
      order.id,
    );
  } catch (invErr) {
    appLog('error', 'guest_inventory_fulfill_failed', {
      orderId: order.id,
      detail: invErr instanceof Error ? invErr.message : String(invErr),
    });
  }

  // No OB points earn/redeem for guests.
  if (method === 'cod') {
    try {
      const { sendOrderConfirmation } = await import('../services/emailService');
      const { sendOrderConfirmationSms, sendOrderConfirmationWhatsApp } = await import('../services/smsService');
      if (guestUser.email) {
        sendOrderConfirmation(guestUser.email, {
          orderNumber: order.orderNumber,
          total: Number(order.total),
          items: order.items.map((i) => ({
            productTitle: i.productTitle,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
        }).catch(() => {});
      }
      if (guestUser.phone) {
        sendOrderConfirmationSms(guestUser.phone, order.orderNumber).catch(() => {});
        sendOrderConfirmationWhatsApp(
          guestUser.phone,
          order.orderNumber,
          Number(order.total),
          order.items.map((i) => ({ productTitle: i.productTitle, quantity: i.quantity })),
        ).catch(() => {});
      }
    } catch { /* non-fatal */ }
  }

  if (guestUser.userType === 'guest') {
    void sendGuestBenefitsEmail(guestUser).catch(() => {});
  }

  try {
    emitAdminEvent('admin:order:new', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      userId: guestUser.id,
      guest: true,
    });
  } catch { /* non-fatal */ }
  try {
    const { alertNewOrder } = await import('../services/teamsService');
    alertNewOrder(order.orderNumber, Number(order.total), guestUser.name).catch(() => {});
  } catch { /* non-fatal */ }

  void publishDomainEvent('OrderPlaced', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    paymentMethod: method,
    guest: true,
  }, { aggregateId: order.id, userId: guestUser.id });

  let redirectUrl: string | undefined;
  let sessionkey: string | undefined;
  let transactionId: string | undefined;

  if (method === 'sslcommerz' && needsOnlinePayment) {
    try {
      const tx = await prisma.paymentTransaction.create({
        data: {
          id: generateEntityId(),
          orderId: order.id,
          userId: guestUser.id,
          method: 'sslcommerz',
          amount: finalTotal,
          metadata: { purpose: 'order_total', tran_id: '', guest: true },
        },
      });
      transactionId = tx.id;
      if (ssl.isSslConfigured()) {
        await prisma.paymentTransaction.update({
          where: { id: tx.id },
          data: { metadata: { purpose: 'order_total', tran_id: tx.id, guest: true } },
        });
        const sslResult = await ssl.initiatePayment({
          transactionId: tx.id,
          orderNumber: order.orderNumber,
          amount: finalTotal,
          customerName: guestUser.name,
          customerEmail: guestUser.email || normalizeEmail(email) || '',
          customerPhone: guestUser.phone || normalizePhone(phone) || '',
        });
        redirectUrl = sslResult.gatewayPageURL;
        sessionkey = sslResult.sessionkey;
      }
    } catch (sslErr) {
      appLog('warn', 'guest_ssl_initiate_failed', {
        orderId: order.id,
        detail: sslErr instanceof Error ? sslErr.message : String(sslErr),
      });
    }
  }

  res.status(201).json({
    order,
    requiresPayment: needsOnlinePayment,
    paymentPurpose: 'order_total',
    deliveryFee: shippingFee,
    pointsEarned: 0,
    tierUpgrade: null,
    codAllowed: validation.codAllowed && finalTotal <= COD_LIMIT,
    redirectUrl,
    sessionkey,
    transactionId,
    guestEmail: guestUser.email,
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

  try {
    const { refreshLiveTrackingForOrder } = await import('../services/courierService');
    await refreshLiveTrackingForOrder(order.id);
  } catch (err: any) {
    console.warn('[orders/track-public] live refresh skipped:', err?.message);
  }

  const refreshed = await prisma.order.findFirst({
    where: { id: order.id },
    include: {
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: { select: { carrier: true, trackingNumber: true, estimatedDelivery: true, status: true } },
      items: { select: { productTitle: true, quantity: true, unitPrice: true } },
    },
  });

  res.json({
    orderNumber: refreshed!.orderNumber,
    status: refreshed!.status,
    createdAt: refreshed!.createdAt,
    total: Number(refreshed!.total),
    items: refreshed!.items,
    timeline: refreshed!.timeline,
    shipments: refreshed!.shipments,
  });
});

// POST /api/orders/place
router.post('/place', requireAuth, async (req: Request, res: Response) => {
  const {
    shippingAddressId,
    paymentMethod,
    couponCode,
    couponId,
    obPointsToRedeem = 0,
    notes,
    policiesAgreed,
    abandonedCheckout = false,
  } = req.body as {
    shippingAddressId: number;
    paymentMethod: string;
    couponCode?: string;
    couponId?: number;
    obPointsToRedeem?: number;
    notes?: string;
    policiesAgreed?: unknown;
    abandonedCheckout?: unknown;
  };

  const onlineMethods = ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'];
  const isAbandonedCheckout = abandonedCheckout === true || abandonedCheckout === 'true' || abandonedCheckout === 1;
  if (!isPoliciesAgreed(policiesAgreed)) {
    res.status(400).json({
      error: 'Please agree to the Terms & Conditions, Privacy Policy, Return Policy, Refund Policy & Shipping Policy before placing your order.',
    });
    return;
  }

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

  const pathaoCityId = Number((address as any).pathaoCityId) || 0;
  const pathaoZoneId = Number((address as any).pathaoZoneId) || 0;

  let resolvedCouponId: number | null = null;
  let resolvedCouponCode: string | undefined;
  if (couponCode || couponId) {
    const coupon = couponCode
      ? await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
      : couponId
        ? await prisma.coupon.findUnique({ where: { id: couponId } })
        : null;
    if (coupon) {
      resolvedCouponId = coupon.id;
      resolvedCouponCode = coupon.code;
    }
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
  const obBalance = await getBalance(req.user!.userId);

  // ── Authoritative pricing / MOQ / stock / COD via Java core ─────────────
  let coreValidation;
  try {
    coreValidation = await validateCheckoutWithCore(req, {
      paymentMethod,
      couponCode: resolvedCouponCode,
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

  const result: {
    totals: OrderTotals;
    obPointsEarned: number;
    codAllowed: boolean;
  } = {
    totals: {
      subtotal: toNumber(coreValidation.totals?.subtotal ?? 0),
      discount: toNumber(coreValidation.totals?.discount ?? 0),
      gst: toNumber(coreValidation.totals?.gst ?? 0),
      shippingFee: toNumber(coreValidation.totals?.shippingFee ?? 0),
      serviceFee: toNumber(coreValidation.totals?.serviceFee ?? 0),
      obDiscount: toNumber(coreValidation.totals?.obDiscount ?? coreValidation.obDiscount ?? 0),
      total: toNumber(coreValidation.totals?.total ?? 0),
      taxableAmount: 0,
      vatInclusive: false,
      vatRate: 0,
    },
    obPointsEarned: coreValidation.obPointsEarned ?? 0,
    codAllowed: coreValidation.codAllowed ?? true,
  };

  // Reconcile VAT with OceanBazar tax policy (7.5% exclusive) — Java core may lag rate.
  try {
    const { calculateOrderTotals } = await import('../utils/pricing');
    const { getActiveTaxPolicy } = await import('../services/taxVatSystem');
    const taxPolicy = await getActiveTaxPolicy();
    const nodeTotals = calculateOrderTotals(
      result.totals.subtotal,
      result.totals.discount,
      result.totals.obDiscount,
      {
        couponFreeShipping: Boolean(coreValidation.freeShipping),
        couponFreeService: Boolean(coreValidation.freeService),
        couponFreeVat: Boolean(coreValidation.freeVat),
        retailQuantityOrder: true,
        vatRate: taxPolicy.vatRate,
        priceInclusive: taxPolicy.priceInclusive,
      },
    );
    result.totals = {
      ...result.totals,
      gst: nodeTotals.gst,
      shippingFee: nodeTotals.shippingFee,
      serviceFee: nodeTotals.serviceFee,
      total: nodeTotals.total,
      taxableAmount: nodeTotals.taxableAmount,
      vatInclusive: nodeTotals.vatInclusive,
      vatRate: nodeTotals.vatRate,
    };
  } catch { /* keep core totals */ }

  const codFeeAmount = paymentMethod === 'cod' ? COD_FEE : 0;

  // Prefer live Pathao quote when address has courier geo IDs; otherwise keep core shipping.
  // Waiver coupons (free delivery / all extra charges) keep shipping at 0.
  const waiveShipping = Boolean(coreValidation.freeShipping);
  let shippingFee = waiveShipping ? 0 : result.totals.shippingFee;
  if (!waiveShipping && pathaoCityId && pathaoZoneId) {
    try {
      const quote = await quotePathaoDelivery({
        pathaoCityId,
        pathaoZoneId,
        itemWeightKg: estimateCartWeightKg(coreValidation.lines.reduce((n, l) => n + (l.quantity || 1), 0)),
      });
      shippingFee = quote.price;
    } catch (quoteErr) {
      appLog('warn', 'pathao_quote_on_place_failed', {
        detail: quoteErr instanceof Error ? quoteErr.message : String(quoteErr),
      });
      // Pay now: keep core shipping as fallback when Pathao is temporarily unavailable
    }
  }

  const baseWithoutShipping = result.totals.total - result.totals.shippingFee;
  const finalTotal = Math.max(0, baseWithoutShipping + shippingFee + codFeeAmount);
  const requiresDeliveryFeePayment = false;
  const needsOnlinePayment = onlineMethods.includes(paymentMethod) && !isAbandonedCheckout;


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
          shippingFee,
          serviceFee: result.totals.serviceFee,
          obPointsUsed: obPointsToRedeem,
          obDiscount: result.totals.obDiscount,
          couponId: resolvedCouponId,
          total: finalTotal,
          paymentMethod: paymentMethod as
            | 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'sslcommerz' | 'installment',
          shippingAddressId,
          notes,
          codFee: codFeeAmount,
          deliveryPaymentStatus: requiresDeliveryFeePayment ? 'pending' : 'none',
          deliveryFeePaid: 0,
          items: { create: orderItems },
          timeline: {
            create: {
              status: 'pending',
              note: isAbandonedCheckout
                ? (paymentMethod === 'cod'
                  ? 'Saved unpaid — cash on delivery'
                  : 'Saved unpaid — awaiting payment')
                : paymentMethod === 'cod'
                  ? 'Order placed — pay when the order arrives'
                  : 'Order placed',
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

      // Keep cart when online / delivery-fee payment is still required so a failed
      // gateway redirect can return the customer to checkout with items intact.
      const deferCartClear = needsOnlinePayment || requiresDeliveryFeePayment;
      if (!deferCartClear) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      return createdOrder;
    });
  } catch (persistErr) {
    appLog('error', 'order_persist_failed', {
      paymentMethod,
      codFeeAmount,
      detail: persistErr instanceof Error ? persistErr.message : String(persistErr),
    });
    throw persistErr;
  }

  try {
    const { extractMetaAttributionFromRequest, storeMetaAttributionForOrder } = await import('../lib/metaAttribution');
    await storeMetaAttributionForOrder(order.id, extractMetaAttributionFromRequest(req));
  } catch { /* non-fatal */ }

  try {
    const {
      getActiveTaxPolicy,
      calculateGatewayFee,
      getActiveGatewayFeePolicy,
      buildOrderTaxSnapshot,
      persistOrderTaxSnapshot,
    } = await import('../services/taxVatSystem');
    const policy = await getActiveTaxPolicy();
    const feePolicy = await getActiveGatewayFeePolicy();
    const gatewayPreview = calculateGatewayFee(finalTotal, feePolicy);
    const snapshot = buildOrderTaxSnapshot({
      totals: {
        subtotal: result.totals.subtotal,
        discount: result.totals.discount,
        gst: result.totals.gst,
        shippingFee,
        serviceFee: result.totals.serviceFee,
        obDiscount: result.totals.obDiscount,
        total: finalTotal,
      },
      policy,
      gateway: gatewayPreview,
    });
    await persistOrderTaxSnapshot(order.id, snapshot);
  } catch { /* non-fatal tax snapshot */ }

  try {
    const { deductInventoryForPlacedOrder } = await import('../services/inventoryStockSync');
    await deductInventoryForPlacedOrder(
      order.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity: i.quantity,
      })),
      order.id,
    );
  } catch (invErr) {
    appLog('error', 'inventory_fulfill_failed', {
      orderId: order.id,
      detail: invErr instanceof Error ? invErr.message : String(invErr),
    });
  }

  // ── OB points: earn + tier upgrade ──────────────────────────────────────

  if (paymentMethod === 'cod' && !requiresDeliveryFeePayment) {
    try {
      const { sendMetaCapiPurchase } = await import('../services/meta/metaCapiService');
      const { mergeCapiUserData } = await import('../lib/metaAttribution');
      const userData = await mergeCapiUserData(
        order.id,
        { email: user.email, phone: user.phone },
        req,
      );
      void sendMetaCapiPurchase({
        orderId: order.id,
        value: Number(order.total),
        contents: order.items.map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          item_price: Number(i.unitPrice),
        })),
        userData,
      });
    } catch { /* non-fatal */ }
  }

  // Confirmation email/SMS: COD with free delivery only. Pay-later with delivery fee
  // and all online methods wait until SSL payment succeeds (payments.ts).
  if (paymentMethod === 'cod' && !requiresDeliveryFeePayment) {
    try {
      const { sendOrderConfirmation } = await import('../services/emailService');
      const { sendOrderConfirmationSms, sendOrderConfirmationWhatsApp } = await import('../services/smsService');
      if (user.email) {
        sendOrderConfirmation(user.email, {
          orderNumber: order.orderNumber,
          total: Number(order.total),
          items: order.items.map((i) => ({
            productTitle: i.productTitle,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
        }).catch(() => {});
      }
      if (user.phone) {
        sendOrderConfirmationSms(user.phone, order.orderNumber).catch(() => {});
        sendOrderConfirmationWhatsApp(
          user.phone,
          order.orderNumber,
          Number(order.total),
          order.items.map((i) => ({ productTitle: i.productTitle, quantity: i.quantity })),
        ).catch(() => {});
      }
    } catch { /* non-fatal */ }
  }

  let pointsEarned = 0;
  let tierUpgrade: string | null = null;
  if (paymentMethod === 'cod' && !requiresDeliveryFeePayment) {
    const ep = await earnPoints(req.user!.userId, orderId, Number(order.total));
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

  const requiresPayment = needsOnlinePayment || requiresDeliveryFeePayment;
  const paymentPurpose = requiresDeliveryFeePayment ? 'delivery_fee' : 'order_total';

  res.status(201).json({
    order,
    requiresPayment,
    paymentPurpose,
    deliveryFee: shippingFee,
    pointsEarned,
    tierUpgrade,
    codAllowed: result.codAllowed,
  });
});

// GET /api/orders
router.get('/', requireAuth, async (req: Request, res: Response) => {
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
router.get('/:id/tracking', requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.userId },
    include: { timeline: { orderBy: { createdAt: 'asc' } }, shipments: true },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  try {
    const { refreshLiveTrackingForOrder } = await import('../services/courierService');
    await refreshLiveTrackingForOrder(order.id);
  } catch (err: any) {
    console.warn('[orders/tracking] live refresh skipped:', err?.message);
  }

  const refreshed = await prisma.order.findFirst({
    where: { id: order.id, userId: req.user!.userId },
    include: { timeline: { orderBy: { createdAt: 'asc' } }, shipments: true },
  });

  res.json({
    orderId: refreshed!.id,
    orderNumber: refreshed!.orderNumber,
    status: refreshed!.status,
    trackingNumber: refreshed!.trackingNumber,
    timeline: refreshed!.timeline,
    shipments: refreshed!.shipments,
  });
});

// GET /api/orders/:id/survey — post-delivery survey + review prompt state
router.get('/:id/survey', requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const { getOrderSurveyState } = await import('../services/orderSurveyService');
    const state = await getOrderSurveyState(id, req.user!.userId);
    if (!state) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load survey' });
  }
});

// POST /api/orders/:id/survey — submit order experience survey
router.post('/:id/survey', requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const { submitOrderSurvey } = await import('../services/orderSurveyService');
    const state = await submitOrderSurvey(id, req.user!.userId, req.body);
    res.status(201).json(state);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to submit survey' });
  }
});

// GET /api/orders/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const requesterId = req.user!.userId;
  const order = await prisma.order.findFirst({
    where: { id, userId: requesterId },
    include: {
      items: true,
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: true,
      shippingAddress: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
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
  // Normalize status fields for invoice / account UI (avoid stale casing mismatches)
  const itemsWithVariants = await attachVariantLabels(prisma, order.items);
  let paymentProcessingFee = 0;
  try {
    const feeRows = await prisma.$queryRaw<Array<{ fee: number | null }>>`
      SELECT COALESCE(payment_processing_fee_amount, 0)::float AS fee
      FROM orders WHERE id = ${order.id}
    `;
    paymentProcessingFee = Number(feeRows?.[0]?.fee || 0);
  } catch { /* column may be missing before migrate */ }
  res.json({
    order: {
      ...order,
      items: itemsWithVariants,
      status: String(order.status || '').toLowerCase(),
      paymentStatus: String(order.paymentStatus || '').toLowerCase(),
      paymentProcessingFee,
      payment_processing_fee_amount: paymentProcessingFee,
      customer: order.user
        ? { name: order.user.name, email: order.user.email, phone: order.user.phone }
        : null,
    },
  });
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
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
  try {
    const { reversePointsForOrder } = await import('../services/obPointsService');
    await reversePointsForOrder(order.id, { reason: 'customer_cancel_unpaid' });
  } catch { /* non-fatal */ }
  // Restore warehouse ledger + catalog stock
  try {
    const { restoreInventoryForCancelledOrder } = await import('../services/inventoryStockSync');
    await restoreInventoryForCancelledOrder(
      order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
      })),
      order.id,
    );
  } catch { /* non-fatal */ }
  try {
    await notifyCustomer({ userId: req.user!.userId, event: 'order_cancelled', vars: { orderNumber: order.orderNumber } });
  } catch { /* non-fatal */ }
  res.json({ message: 'Order cancelled' });
});

// POST /api/orders/:id/reorder — re-add all items from a past order to cart
router.post('/:id/reorder', requireAuth, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const userId = req.user!.userId;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) { cart = await prisma.cart.create({ data: { userId } }); }

  const userType = req.user!.userType as string;
  let addedCount = 0;

  for (const item of order.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { pricing: true },
    });
    if (!product || product.stock <= 0) continue;
    const pricing = product.pricing.find((p) => p.customerType === userType)
      ?? product.pricing.find((p) => p.customerType === 'retail');
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
