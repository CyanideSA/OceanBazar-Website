import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { calculatePrice, calculateOrderTotals, isCodAllowed, RETAIL_MAX_UNITS, type PricingRow } from '../utils/pricing';
import { toPricingRow, applyVariantOverride } from '../utils/lineItemPricing';
import { validateCoupon, applyCoupon, type CouponData } from '../utils/couponRules';
import { validateRedemption, getTier } from '../utils/obPoints';
import { getBalance } from '../services/obPointsService';
import { routeParam } from '../utils/params';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

async function getOrCreateCart(userId: string) {
  const include = {
    items: {
      include: {
        product: { include: { pricing: true, productAssets: { where: { isPrimary: true }, take: 1 } } },
        variant: true,
      },
    },
  } as const;

  let cart = await prisma.cart.findUnique({ where: { userId }, include });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId }, include });
  }
  return cart;
}

function buildCartSummary(cart: Awaited<ReturnType<typeof getOrCreateCart>>, userType: 'retail' | 'wholesale') {
  const items = cart.items.map((item) => {
    const retail = item.product.pricing.find((p) => p.customerType === 'retail');
    const wholesale = item.product.pricing.find((p) => p.customerType === 'wholesale');
    const ov = item.variant?.price_override;
    const retailRow = applyVariantOverride(toPricingRow(retail), ov);
    const wholesaleRow = applyVariantOverride(toPricingRow(wholesale), ov);
    const pr = calculatePrice(
      userType,
      { retail: retailRow ?? { price: 0 }, wholesale: wholesaleRow },
      item.quantity,
      item.product.moq,
    );

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      title: item.product.titleEn,
      image: item.product.productAssets[0]?.url ?? null,
      quantity: item.quantity,
      unitPrice: pr.unitPrice,
      lineTotal: pr.lineTotal,
      discountPct: pr.discountPct,
      tierApplied: pr.tierApplied,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const totals = calculateOrderTotals(subtotal);

  return {
    cartId: cart.id,
    items,
    ...totals,
    codAllowed: isCodAllowed(totals.total),
    installmentAllowed: false,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
  };
}

// GET /api/cart
router.get('/', async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.user!.userId);
  res.json(buildCartSummary(cart, req.user!.userType));
});

// POST /api/cart/add
router.post('/add', async (req: Request, res: Response) => {
  const { productId, variantId, quantity = 1 } = req.body as {
    productId: string;
    variantId?: string;
    quantity: number;
  };

  const product = await prisma.product.findUnique({
    where: { id: productId, status: 'active' },
    include: { pricing: true },
  });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

  if (quantity < 1) { res.status(400).json({ error: 'Quantity must be at least 1' }); return; }
  if (quantity > product.stock) {
    res.status(400).json({ error: `Only ${product.stock} available in stock` }); return;
  }

  const hasWholesale = product.pricing.some((p) => p.customerType === 'wholesale');
  const wholesaleThreshold = product.moq ?? 1;
  const isWholesaleQty = hasWholesale && quantity >= wholesaleThreshold;
  if (req.user!.userType === 'retail' && !isWholesaleQty && quantity > RETAIL_MAX_UNITS) {
    res.status(400).json({ error: `Retail orders are limited to ${RETAIL_MAX_UNITS} units. Add ${wholesaleThreshold}+ units for wholesale pricing.` }); return;
  }

  let variant: { id: string; priceOverride: unknown } | null = null;
  if (variantId) {
    const v = await prisma.productVariant.findFirst({
      where: { id: variantId, productId, isActive: true },
    });
    if (!v) { res.status(400).json({ error: 'Invalid variant' }); return; }
    variant = v;
  }

  const cart = await prisma.cart.upsert({
    where: { userId: req.user!.userId },
    create: { userId: req.user!.userId },
    update: {},
  });

  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId: variantId ?? null },
  });

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > product.stock) {
      res.status(400).json({ error: `Cannot add more — only ${product.stock} available` }); return;
    }
    const isNewQtyWholesale = hasWholesale && newQty >= wholesaleThreshold;
    if (req.user!.userType === 'retail' && !isNewQtyWholesale && newQty > RETAIL_MAX_UNITS) {
      res.status(400).json({ error: `Retail orders are limited to ${RETAIL_MAX_UNITS} units per item.` }); return;
    }
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: quantity } },
    });
  } else {
    const retail = product.pricing.find((p) => p.customerType === 'retail');
    const wholesale = product.pricing.find((p) => p.customerType === 'wholesale');
    const ov = variant?.priceOverride;
    const retailRow = applyVariantOverride(toPricingRow(retail), ov);
    const wholesaleRow = applyVariantOverride(toPricingRow(wholesale), ov);
    const pr = calculatePrice(
      req.user!.userType,
      { retail: retailRow ?? { price: 0 }, wholesale: wholesaleRow },
      quantity,
      product.moq,
    );
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantId ?? null,
        quantity,
        unitPrice: pr.unitPrice,
        customerType: req.user!.userType,
      },
    });
  }

  const updatedCart = await getOrCreateCart(req.user!.userId);
  res.json(buildCartSummary(updatedCart, req.user!.userType));
});

// PUT /api/cart/update
router.put('/update', async (req: Request, res: Response) => {
  const { itemId, quantity } = req.body as { itemId: number; quantity: number };
  if (quantity < 1) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    const existingItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: { include: { pricing: true } } },
    });
    if (existingItem) {
      const itemHasWholesale = existingItem.product.pricing.some((p) => p.customerType === 'wholesale');
      const itemMoq = existingItem.product.moq ?? 1;
      const isWholesaleQty = itemHasWholesale && quantity >= itemMoq;
      if (req.user!.userType === 'retail' && !isWholesaleQty && quantity > RETAIL_MAX_UNITS) {
        res.status(400).json({ error: `Retail orders are limited to ${RETAIL_MAX_UNITS} units per item.` }); return;
      }
      if (quantity > existingItem.product.stock) {
        res.status(400).json({ error: `Only ${existingItem.product.stock} available in stock` }); return;
      }
    }
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }
  const cart = await getOrCreateCart(req.user!.userId);
  res.json(buildCartSummary(cart, req.user!.userType));
});

// DELETE /api/cart/remove/:productId
router.delete('/remove/:productId', async (req: Request, res: Response) => {
  const cart = await prisma.cart.findUnique({ where: { userId: req.user!.userId } });
  if (cart) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId: routeParam(req.params.productId) },
    });
  }
  const updatedCart = await getOrCreateCart(req.user!.userId);
  res.json(buildCartSummary(updatedCart, req.user!.userType));
});

// POST /api/cart/apply-coupon — validate + preview
router.post('/apply-coupon', async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  if (!code?.trim()) { res.status(400).json({ error: 'Coupon code required' }); return; }

  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) { res.status(404).json({ error: 'Invalid coupon code' }); return; }

  const cart = await getOrCreateCart(req.user!.userId);
  const summary = buildCartSummary(cart, req.user!.userType);

  const couponData: CouponData = {
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

  const v = validateCoupon({ coupon: couponData, subtotal: summary.subtotal });
  if (!v.valid) { res.status(400).json({ error: v.error }); return; }

  const applied = applyCoupon(couponData, summary.subtotal);
  res.json({
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: Number(coupon.value) },
    discountAmount: applied.discountAmount,
    freeShipping: applied.freeShipping,
  });
});

// POST /api/cart/apply-ob-points — validate + preview
router.post('/apply-ob-points', async (req: Request, res: Response) => {
  const { points } = req.body as { points: number };
  if (!points || points < 0) { res.status(400).json({ error: 'Invalid points amount' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const balance = await getBalance(req.user!.userId);
  const tier = getTier(Number(user.lifetimeSpend));
  const result = validateRedemption(tier, balance, points);
  if (!result.valid) { res.status(400).json({ error: result.error }); return; }

  res.json({ points, bdtDiscount: result.bdtValue, tier, balance });
});

export default router;
