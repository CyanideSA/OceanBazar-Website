import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import { proxyCartToCore, validateCheckoutWithCore, toNumber } from '../clients/commerce-client';
import { getBalance } from '../services/obPointsService';
import { getTier, validateRedemption } from '../utils/obPoints';
import { routeParam } from '../utils/params';
import { appLog } from '../lib/appLog';

const router = Router();

router.use(requireAuth);

function handleCoreProxyError(err: unknown, res: Response, req?: Request): void {
  const ax = err as { response?: { status?: number; data?: unknown }; message?: string };
  if (ax.response) {
    res.status(ax.response.status || 502).json(ax.response.data ?? { error: 'Core API error' });
    return;
  }
  appLog('error', 'cart_core_proxy_failed', { detail: ax.message });
  res.status(502).json({ error: 'Commerce core unavailable', detail: ax.message });
}

// GET /api/cart — pricing/stock/MOQ from Java CartService (single source of truth)
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await proxyCartToCore(req, 'GET', '');
    res.json(data);
  } catch (e) {
    handleCoreProxyError(e, res);
  }
});

// POST /api/cart/add
router.post('/add', async (req: Request, res: Response) => {
  try {
    const data = await proxyCartToCore(req, 'POST', '/add', req.body);
    res.json(data);
  } catch (e) {
    handleCoreProxyError(e, res, req);
  }
});

// PUT /api/cart/update
router.put('/update', async (req: Request, res: Response) => {
  const body = req.body as {
    itemId?: number;
    productId?: string;
    quantity?: number;
    variantId?: string | null;
  };
  try {
    if (body.productId != null) {
      const data = await proxyCartToCore(req, 'PUT', '/update', {
        productId: body.productId,
        quantity: body.quantity ?? 0,
        variantId: body.variantId ?? undefined,
      });
      res.json(data);
      return;
    }
    res.status(400).json({ error: 'productId required for cart update via core API' });
  } catch (e) {
    handleCoreProxyError(e, res);
  }
});

// DELETE /api/cart/remove/:productId
router.delete('/remove/:productId', async (req: Request, res: Response) => {
  try {
    const productId = routeParam(req.params.productId);
    const variantId =
      typeof req.query.variantId === 'string' && req.query.variantId.trim()
        ? req.query.variantId.trim()
        : undefined;
    const qs = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    const data = await proxyCartToCore(req, 'DELETE', `/remove/${productId}${qs}`);
    res.json(data);
  } catch (e) {
    handleCoreProxyError(e, res);
  }
});

// POST /api/cart/apply-coupon — preview uses Java checkout validator for authoritative subtotal
router.post('/apply-coupon', async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  if (!code?.trim()) {
    res.status(400).json({ error: 'Coupon code required' });
    return;
  }

  try {
    const validation = await validateCheckoutWithCore(req, {
      paymentMethod: 'cod',
      couponCode: code.trim().toUpperCase(),
      obPointsToRedeem: 0,
      obBalance: await getBalance(req.user!.userId),
      shippingAddressId: undefined,
    });
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0] || 'Coupon not applicable' });
      return;
    }
    const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    res.json({
      coupon: coupon
        ? { id: coupon.id, code: coupon.code, type: coupon.type, value: Number(coupon.value) }
        : { code: code.trim().toUpperCase() },
      discountAmount: toNumber(validation.couponDiscount ?? 0),
      freeShipping: Boolean(validation.freeShipping),
      subtotal: validation.totals ? toNumber(validation.totals.subtotal) : 0,
    });
  } catch (e) {
    handleCoreProxyError(e, res);
  }
});

// POST /api/cart/apply-ob-points
router.post('/apply-ob-points', async (req: Request, res: Response) => {
  const { points } = req.body as { points: number };
  if (!points || points < 0) {
    res.status(400).json({ error: 'Invalid points amount' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const balance = await getBalance(req.user!.userId);
  const tier = getTier(Number(user.lifetimeSpend));
  const result = validateRedemption(tier, balance, points);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ points, bdtDiscount: result.bdtValue, tier, balance });
});

export default router;
