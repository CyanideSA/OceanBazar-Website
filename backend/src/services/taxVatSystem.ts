/**
 * Bangladesh VAT + SSLCommerz fee foundation for OceanBazar (Node/Prisma).
 * - Standard VAT: configurable (default 7.5% exclusive).
 * - SSLCommerz 2.5%: shown and added to customer total for online (SSL) checkout when pass-through is enabled.
 * - Pathao shipping overlay unchanged; shipping/service not VAT'd separately.
 * - Historical orders keep tax_snapshot; admin can change rates via Finance VAT settings.
 */
import { prisma } from '../lib/prisma';
import { GST_RATE, round2 } from '../utils/pricing';

export const TAX_ENGINE_VERSION = 'ob-tax-1.0';

export type TaxPolicy = {
  categoryCode: string;
  ruleId: string | null;
  vatRatePercent: number;
  vatRate: number;
  priceInclusive: boolean;
  taxType: string;
};

export type GatewayFeePolicy = {
  provider: string;
  feeType: string;
  feeRatePercent: number;
  feeRate: number;
  fixedFee: number;
  passThroughToCustomer: boolean;
};

let schemaReady: Promise<void> | null = null;
let taxCache: { at: number; policy: TaxPolicy } | null = null;
let feeCache: { at: number; policy: GatewayFeePolicy } | null = null;
const CACHE_MS = 60_000;

export async function ensureTaxVatSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tax_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(150) NOT NULL,
          description TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tax_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tax_category_id UUID NOT NULL REFERENCES tax_categories(id),
          name VARCHAR(150) NOT NULL,
          tax_type VARCHAR(50) NOT NULL DEFAULT 'VAT',
          vat_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
          supplementary_duty_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
          other_tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
          price_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
          input_tax_credit_allowed BOOLEAN NOT NULL DEFAULT FALSE,
          effective_from DATE NOT NULL,
          effective_to DATE NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS gateway_fee_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provider VARCHAR(50) NOT NULL,
          fee_type VARCHAR(30) NOT NULL DEFAULT 'PERCENTAGE',
          fee_rate NUMERIC(7,4) NOT NULL,
          fixed_fee NUMERIC(19,4) NOT NULL DEFAULT 0,
          currency CHAR(3) NOT NULL DEFAULT 'BDT',
          effective_from DATE NOT NULL,
          effective_to DATE NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS tax_calculation_version VARCHAR(50),
          ADD COLUMN IF NOT EXISTS tax_snapshot JSONB,
          ADD COLUMN IF NOT EXISTS payment_processing_fee_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS gateway_fee_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS gateway_settlement_amount NUMERIC(19,4)`);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE payment_transactions
          ADD COLUMN IF NOT EXISTS gateway_fee_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS gateway_fee_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC(19,4)`);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE gateway_fee_rules
          ADD COLUMN IF NOT EXISTS pass_through_to_customer BOOLEAN NOT NULL DEFAULT TRUE`);
      await prisma.$executeRawUnsafe(`
        INSERT INTO tax_categories (id, code, name, description)
        VALUES
          ('11111111-1111-1111-1111-111111111111', 'STANDARD', 'Standard VAT', 'Default OceanBazar taxable goods'),
          ('22222222-2222-2222-2222-222222222222', 'ZERO_RATED', 'Zero-rated', '0% VAT'),
          ('33333333-3333-3333-3333-333333333333', 'EXEMPT', 'Exempt', 'VAT-exempt supplies')
        ON CONFLICT (code) DO NOTHING`);
      await prisma.$executeRawUnsafe(`
        INSERT INTO tax_rules (
          id, tax_category_id, name, tax_type, vat_rate, price_inclusive,
          effective_from, priority, active
        )
        SELECT
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          c.id,
          'OceanBazar standard inclusive VAT',
          'VAT',
          7.5000,
          TRUE,
          DATE '2024-01-01',
          100,
          TRUE
        FROM tax_categories c
        WHERE c.code = 'STANDARD'
        ON CONFLICT (id) DO UPDATE SET
          vat_rate = EXCLUDED.vat_rate,
          price_inclusive = EXCLUDED.price_inclusive,
          name = EXCLUDED.name,
          updated_at = NOW()`);
      await prisma.$executeRawUnsafe(`
        INSERT INTO gateway_fee_rules (
          id, provider, fee_type, fee_rate, fixed_fee, currency, effective_from, active, pass_through_to_customer
        )
        VALUES (
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          'SSLCommerz',
          'PERCENTAGE',
          2.5000,
          0,
          'BDT',
          DATE '2024-01-01',
          TRUE,
          FALSE
        )
        ON CONFLICT (id) DO UPDATE SET
          fee_rate = EXCLUDED.fee_rate,
          pass_through_to_customer = FALSE,
          updated_at = NOW()`);
      await prisma.$executeRawUnsafe(`
        UPDATE gateway_fee_rules
        SET pass_through_to_customer = FALSE, updated_at = NOW()
        WHERE provider = 'SSLCommerz' AND active = TRUE`);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function defaultTaxPolicy(): TaxPolicy {
  return {
    categoryCode: 'STANDARD',
    ruleId: null,
    vatRatePercent: round2(GST_RATE * 100),
    vatRate: GST_RATE,
    priceInclusive: true,
    taxType: 'VAT',
  };
}

function defaultGatewayFeePolicy(): GatewayFeePolicy {
  // Merchant absorbs SSLCommerz ~2.5% — never added to customer checkout total.
  const env = String(process.env.CUSTOMER_GATEWAY_FEE_PASSTHROUGH || 'false').toLowerCase();
  const passThrough = env === 'true' || env === '1';
  return {
    provider: 'SSLCommerz',
    feeType: 'PERCENTAGE',
    feeRatePercent: 2.5,
    feeRate: 0.025,
    fixedFee: 0,
    passThroughToCustomer: passThrough,
  };
}

export async function getActiveTaxPolicy(asOf: Date = new Date()): Promise<TaxPolicy> {
  const now = Date.now();
  if (taxCache && now - taxCache.at < CACHE_MS) return taxCache.policy;
  try {
    await ensureTaxVatSchema();
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        code: string;
        vat_rate: number;
        price_inclusive: boolean;
        tax_type: string;
      }>
    >`
      SELECT r.id, c.code, r.vat_rate::float AS vat_rate, r.price_inclusive, r.tax_type
      FROM tax_rules r
      JOIN tax_categories c ON c.id = r.tax_category_id
      WHERE r.active = TRUE
        AND c.active = TRUE
        AND c.code = 'STANDARD'
        AND r.effective_from <= ${asOf}::date
        AND (r.effective_to IS NULL OR r.effective_to >= ${asOf}::date)
      ORDER BY r.priority DESC, r.effective_from DESC
      LIMIT 1
    `;
    if (!rows[0]) {
      const policy = defaultTaxPolicy();
      taxCache = { at: now, policy };
      return policy;
    }
    const pct = Number(rows[0].vat_rate) || 0;
    const policy: TaxPolicy = {
      categoryCode: rows[0].code,
      ruleId: rows[0].id,
      vatRatePercent: pct,
      vatRate: pct / 100,
      priceInclusive: Boolean(rows[0].price_inclusive),
      taxType: String(rows[0].tax_type || 'VAT'),
    };
    taxCache = { at: now, policy };
    return policy;
  } catch {
    return defaultTaxPolicy();
  }
}

export async function getActiveGatewayFeePolicy(asOf: Date = new Date()): Promise<GatewayFeePolicy> {
  const now = Date.now();
  if (feeCache && now - feeCache.at < CACHE_MS) return feeCache.policy;
  const base = defaultGatewayFeePolicy();
  try {
    await ensureTaxVatSchema();
    const rows = await prisma.$queryRaw<
      Array<{ provider: string; fee_type: string; fee_rate: number; fixed_fee: number; pass_through_to_customer: boolean }>
    >`
      SELECT provider, fee_type, fee_rate::float AS fee_rate, fixed_fee::float AS fixed_fee,
             COALESCE(pass_through_to_customer, TRUE) AS pass_through_to_customer
      FROM gateway_fee_rules
      WHERE active = TRUE
        AND provider = 'SSLCommerz'
        AND effective_from <= ${asOf}::date
        AND (effective_to IS NULL OR effective_to >= ${asOf}::date)
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    if (!rows[0]) {
      feeCache = { at: now, policy: base };
      return base;
    }
    const pct = Number(rows[0].fee_rate) || 0;
    const envOff = String(process.env.CUSTOMER_GATEWAY_FEE_PASSTHROUGH || 'true').toLowerCase() === 'false';
    const policy: GatewayFeePolicy = {
      provider: rows[0].provider,
      feeType: rows[0].fee_type,
      feeRatePercent: pct,
      feeRate: pct / 100,
      fixedFee: Number(rows[0].fixed_fee) || 0,
      passThroughToCustomer: envOff ? false : Boolean(rows[0].pass_through_to_customer),
    };
    feeCache = { at: now, policy };
    return policy;
  } catch {
    return base;
  }
}

export function calculateGatewayFee(customerPayment: number, policy?: GatewayFeePolicy) {
  const p = policy || defaultGatewayFeePolicy();
  const gross = Math.max(0, Number(customerPayment) || 0);
  const fee = round2(gross * p.feeRate + p.fixedFee);
  const settlement = round2(Math.max(0, gross - fee));
  return {
    feeRatePercent: p.feeRatePercent,
    feeRate: p.feeRate,
    feeAmount: fee,
    settlementAmount: settlement,
    passThroughToCustomer: p.passThroughToCustomer,
    provider: p.provider,
  };
}

/** Online SSL pay only — COD and similar do not add gateway fee to customer. */
export function customerFacingPaymentFee(
  orderTotalBeforeFee: number,
  paymentMethod: string,
  policy?: GatewayFeePolicy,
): { feeAmount: number; totalWithFee: number; applied: boolean; ratePercent: number } {
  const p = policy || defaultGatewayFeePolicy();
  const method = String(paymentMethod || '').toLowerCase();
  const online =
    method === 'sslcommerz' ||
    method === 'bkash' ||
    method === 'nagad' ||
    method === 'rocket' ||
    method === 'upay';
  if (!online || !p.passThroughToCustomer) {
    return {
      feeAmount: 0,
      totalWithFee: round2(orderTotalBeforeFee),
      applied: false,
      ratePercent: p.feeRatePercent,
    };
  }
  const fee = calculateGatewayFee(orderTotalBeforeFee, p);
  return {
    feeAmount: fee.feeAmount,
    totalWithFee: round2(orderTotalBeforeFee + fee.feeAmount),
    applied: true,
    ratePercent: p.feeRatePercent,
  };
}

export function clearTaxPolicyCache() {
  taxCache = null;
  feeCache = null;
}

export async function updateTaxAndGatewayConfig(input: {
  vatRatePercent: number;
  priceInclusive: boolean;
  gatewayFeeRatePercent: number;
  passThroughToCustomer: boolean;
  effectiveFrom?: string;
  reason?: string;
  adminId?: string;
}) {
  await ensureTaxVatSchema();
  const vatPct = Math.max(0, Number(input.vatRatePercent) || 0);
  const feePct = Math.max(0, Number(input.gatewayFeeRatePercent) || 0);
  const from = input.effectiveFrom || new Date().toISOString().slice(0, 10);

  // Close previous open STANDARD rule, insert new dated rule (preserves history).
  await prisma.$executeRaw`
    UPDATE tax_rules
    SET effective_to = (${from}::date - INTERVAL '1 day')::date,
        updated_at = NOW()
    WHERE active = TRUE
      AND tax_category_id = (SELECT id FROM tax_categories WHERE code = 'STANDARD' LIMIT 1)
      AND effective_to IS NULL
      AND effective_from < ${from}::date
  `;
  await prisma.$executeRaw`
    INSERT INTO tax_rules (
      tax_category_id, name, tax_type, vat_rate, price_inclusive,
      effective_from, priority, active
    )
    SELECT
      c.id,
      ${`OceanBazar STANDARD VAT ${vatPct}%`},
      'VAT',
      ${vatPct},
      ${Boolean(input.priceInclusive)},
      ${from}::date,
      200,
      TRUE
    FROM tax_categories c
    WHERE c.code = 'STANDARD'
  `;
  await prisma.$executeRaw`
    UPDATE gateway_fee_rules
    SET fee_rate = ${feePct},
        pass_through_to_customer = ${Boolean(input.passThroughToCustomer)},
        updated_at = NOW()
    WHERE provider = 'SSLCommerz' AND active = TRUE
  `;

  try {
    await prisma.$executeRaw`
      INSERT INTO tax_audit_logs (id, entity_type, entity_id, action, new_value, reason, performed_by, created_at)
      VALUES (
        gen_random_uuid(),
        'tax_policy',
        'STANDARD',
        'UPDATE',
        ${JSON.stringify(input)}::jsonb,
        ${input.reason || 'Admin CRM VAT settings update'},
        ${input.adminId || null},
        NOW()
      )
    `;
  } catch {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tax_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value JSONB,
        new_value JSONB,
        reason TEXT,
        performed_by VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
  }

  clearTaxPolicyCache();
  return {
    tax: await getActiveTaxPolicy(),
    gateway: await getActiveGatewayFeePolicy(),
  };
}

export function buildOrderTaxSnapshot(input: {
  totals: {
    subtotal: number;
    discount: number;
    gst: number;
    shippingFee: number;
    serviceFee: number;
    obDiscount: number;
    total: number;
    taxableAmount?: number;
  };
  policy: TaxPolicy;
  gateway?: ReturnType<typeof calculateGatewayFee> | null;
}) {
  const taxable =
    input.totals.taxableAmount != null
      ? input.totals.taxableAmount
      : input.policy.priceInclusive
        ? round2(Math.max(0, input.totals.subtotal - input.totals.discount) / (1 + input.policy.vatRate))
        : round2(Math.max(0, input.totals.subtotal - input.totals.discount));
  return {
    taxEngineVersion: TAX_ENGINE_VERSION,
    calculatedAt: new Date().toISOString(),
    currency: 'BDT',
    categoryCode: input.policy.categoryCode,
    taxRuleId: input.policy.ruleId,
    vatRatePercent: input.policy.vatRatePercent,
    priceInclusive: input.policy.priceInclusive,
    taxableAmount: taxable,
    vatAmount: input.totals.gst,
    shippingFee: input.totals.shippingFee,
    serviceFee: input.totals.serviceFee,
    discount: input.totals.discount,
    obDiscount: input.totals.obDiscount,
    grandTotal: input.totals.total,
    gatewayFee: input.gateway
      ? {
          provider: input.gateway.provider,
          ratePercent: input.gateway.feeRatePercent,
          amount: input.gateway.feeAmount,
          settlement: input.gateway.settlementAmount,
          chargedToCustomer: false,
        }
      : null,
    note: 'SSLCommerz fee is merchant expense and is not added to customer total unless CUSTOMER_GATEWAY_FEE_PASSTHROUGH=true (unsupported in checkout).',
  };
}

export async function persistOrderTaxSnapshot(orderId: string, snapshot: Record<string, unknown>) {
  try {
    await ensureTaxVatSchema();
    await prisma.$executeRaw`
      UPDATE orders
      SET tax_calculation_version = ${TAX_ENGINE_VERSION},
          tax_snapshot = ${JSON.stringify(snapshot)}::jsonb
      WHERE id = ${orderId}
    `;
  } catch {
    /* non-fatal — order already placed */
  }
}

export async function persistGatewayFeeOnPayment(opts: {
  orderId: string;
  paymentTransactionId: string;
  customerPayment: number;
}) {
  const policy = await getActiveGatewayFeePolicy();
  const fee = calculateGatewayFee(opts.customerPayment, policy);
  try {
    await ensureTaxVatSchema();
    await prisma.$executeRaw`
      UPDATE payment_transactions
      SET gateway_fee_rate = ${fee.feeRatePercent},
          gateway_fee_amount = ${fee.feeAmount},
          settlement_amount = ${fee.settlementAmount}
      WHERE id = ${opts.paymentTransactionId}
    `;
    await prisma.$executeRaw`
      UPDATE orders
      SET payment_processing_fee_amount = ${fee.feeAmount},
          gateway_fee_rate = ${fee.feeRatePercent},
          gateway_settlement_amount = ${fee.settlementAmount}
      WHERE id = ${opts.orderId}
    `;
  } catch {
    /* non-fatal */
  }
  return fee;
}

export async function getFinanceVatSummary(days = 30) {
  await ensureTaxVatSchema();
  const since = new Date(Date.now() - Math.max(1, days) * 86400_000);
  const rows = await prisma.$queryRaw<
    Array<{
      gross_sales: number;
      output_vat: number;
      ssl_fees: number;
      settlement: number;
      order_count: number;
    }>
  >`
    SELECT
      COALESCE(SUM(total), 0)::float AS gross_sales,
      COALESCE(SUM(gst), 0)::float AS output_vat,
      COALESCE(SUM(payment_processing_fee_amount), 0)::float AS ssl_fees,
      COALESCE(SUM(COALESCE(gateway_settlement_amount, total - payment_processing_fee_amount)), 0)::float AS settlement,
      COUNT(*)::int AS order_count
    FROM orders
    WHERE created_at >= ${since}
      AND payment_status IN ('paid', 'under_verification', 'pending_verification')
  `;
  const tax = await getActiveTaxPolicy();
  const fee = await getActiveGatewayFeePolicy();
  const r = rows[0] || { gross_sales: 0, output_vat: 0, ssl_fees: 0, settlement: 0, order_count: 0 };
  return {
    periodDays: days,
    taxPolicy: tax,
    gatewayFeePolicy: fee,
    grossSales: round2(r.gross_sales),
    outputVat: round2(r.output_vat),
    sslCommerzFees: round2(r.ssl_fees),
    gatewaySettlement: round2(r.settlement),
    orderCount: Number(r.order_count) || 0,
    estimatedNetVat: round2(r.output_vat),
    disclaimer:
      'Estimated figures for internal finance. Confirm NBR treatment with your accountant. SSLCommerz fees are expenses, not VAT.',
  };
}
