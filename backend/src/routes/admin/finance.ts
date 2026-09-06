import { Router, Request, Response } from 'express';
import { requireAdmin, requireRole } from '../../middleware/auth';
import {
  ensureTaxVatSchema,
  getActiveTaxPolicy,
  getActiveGatewayFeePolicy,
  getFinanceVatSummary,
  updateTaxAndGatewayConfig,
} from '../../services/taxVatSystem';

const router = Router();

router.use(requireAdmin);

/** GET /api/admin/finance/vat-summary?days=30 */
router.get('/vat-summary', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const summary = await getFinanceVatSummary(days);
    res.json(summary);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'VAT summary failed' });
  }
});

/** GET /api/admin/finance/tax-policy */
router.get('/tax-policy', requireRole('super_admin', 'admin'), async (_req: Request, res: Response) => {
  try {
    await ensureTaxVatSchema();
    const [tax, gateway] = await Promise.all([getActiveTaxPolicy(), getActiveGatewayFeePolicy()]);
    res.json({
      tax,
      gateway,
      customerCheckout: {
        showsGatewayFee: gateway.passThroughToCustomer,
        note: gateway.passThroughToCustomer
          ? 'SSLCommerz fee is added to customer total for online pay.'
          : 'SSLCommerz fee is merchant-only (not added to customer total).',
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Tax policy failed' });
  }
});

/** PUT /api/admin/finance/tax-policy â€” Settings form for NBR rate changes */
router.put('/tax-policy', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const vatRatePercent = Number(body.vatRatePercent ?? body.vat_rate_percent);
    const gatewayFeeRatePercent = Number(body.gatewayFeeRatePercent ?? body.gateway_fee_rate_percent ?? 2.5);
    if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
      res.status(400).json({ error: 'vatRatePercent must be 0â€“100' });
      return;
    }
    if (!Number.isFinite(gatewayFeeRatePercent) || gatewayFeeRatePercent < 0 || gatewayFeeRatePercent > 100) {
      res.status(400).json({ error: 'gatewayFeeRatePercent must be 0â€“100' });
      return;
    }
    const updated = await updateTaxAndGatewayConfig({
      vatRatePercent,
      priceInclusive: Boolean(body.priceInclusive ?? body.price_inclusive),
      gatewayFeeRatePercent,
      passThroughToCustomer:
        body.passThroughToCustomer != null
          ? Boolean(body.passThroughToCustomer)
          : body.pass_through_to_customer != null
            ? Boolean(body.pass_through_to_customer)
            : false,
      effectiveFrom:
        body.effectiveFrom != null
          ? String(body.effectiveFrom)
          : body.effective_from != null
            ? String(body.effective_from)
            : undefined,
      reason: String(body.reason || '').trim() || 'Admin VAT settings update',
      adminId: req.admin?.adminId != null ? String(req.admin.adminId) : undefined,
    });
    res.json(updated);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Tax policy update failed' });
  }
});

export default router;
