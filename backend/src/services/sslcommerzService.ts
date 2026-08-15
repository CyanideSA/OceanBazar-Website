import crypto from 'crypto';
import SSLCommerzPayment from 'sslcommerz-lts';
import { prisma } from '../lib/prisma';

const API_BASE = (process.env.API_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export type SslMode = 'sandbox' | 'live';

export interface SslResolvedCredentials {
  mode: SslMode;
  storeId: string;
  storePassword: string;
  source: 'db' | 'env' | 'legacy';
}

export interface SslPublicConfig {
  mode: SslMode;
  embedScriptUrl: string;
  configured: boolean;
}

export interface SslCustomerAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
}

export interface SslInitPayload {
  transactionId: string;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: SslCustomerAddress;
  shippingAddress?: SslCustomerAddress;
  productName?: string;
  numOfItem?: number;
}

export interface SslInitResult {
  gatewayPageURL: string;
  storeLogo?: string;
  sessionkey?: string;
  raw: Record<string, unknown>;
}

export interface SslValidationResult {
  isValid: boolean;
  tranId: string;
  amount: number;
  currency: string;
  bankTranId?: string;
  cardType?: string;
  valId?: string;
  raw: Record<string, unknown>;
}

export interface SslRefundParams {
  bankTranId: string;
  refundAmount: number;
  refundRemarks: string;
  refundTransId: string;
  refeId?: string;
}

let cachedSettingsAt = 0;
let cachedSettings: {
  sandboxId?: string | null;
  sandboxPass?: string | null;
  liveId?: string | null;
  livePass?: string | null;
  legacyId?: string | null;
  legacyPass?: string | null;
  mode?: string | null;
} | null = null;

async function loadSettingsRow() {
  const now = Date.now();
  if (cachedSettings && now - cachedSettingsAt < 15_000) return cachedSettings;
  try {
    const row = await prisma.site_settings.findFirst({
      where: { id: 'default' },
      select: {
        sslcommerz_sandbox_store_id: true,
        sslcommerz_sandbox_store_password: true,
        sslcommerz_live_store_id: true,
        sslcommerz_live_store_password: true,
        sslcommerz_store_id: true,
        sslcommerz_store_password: true,
        sslcommerz_mode: true,
      },
    });
    cachedSettings = row
      ? {
          sandboxId: row.sslcommerz_sandbox_store_id,
          sandboxPass: row.sslcommerz_sandbox_store_password,
          liveId: row.sslcommerz_live_store_id,
          livePass: row.sslcommerz_live_store_password,
          legacyId: row.sslcommerz_store_id,
          legacyPass: row.sslcommerz_store_password,
          mode: row.sslcommerz_mode,
        }
      : null;
    cachedSettingsAt = now;
  } catch {
    cachedSettings = null;
    cachedSettingsAt = now;
  }
  return cachedSettings;
}

/** Clear cached credentials after admin saves settings. */
export function invalidateSslCredentialCache() {
  cachedSettings = null;
  cachedSettingsAt = 0;
}

function normalizeMode(raw: string | null | undefined): SslMode | null {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'live' || v === 'production') return 'live';
  if (v === 'sandbox' || v === 'test') return 'sandbox';
  return null;
}

export async function resolveSslCredentials(): Promise<SslResolvedCredentials> {
  const settings = await loadSettingsRow();

  const envMode =
    normalizeMode(process.env.SSLCOMMERZ_MODE)
    || (process.env.SSLCOMMERZ_SANDBOX === 'false' ? 'live' : null)
    || (process.env.SSLCOMMERZ_SANDBOX === 'true' ? 'sandbox' : null);

  const mode: SslMode =
    normalizeMode(settings?.mode)
    || envMode
    || 'sandbox';

  if (mode === 'live') {
    const dbId = String(settings?.liveId || '').trim();
    const dbPass = String(settings?.livePass || '').trim();
    if (dbId && dbPass) {
      return { mode, storeId: dbId, storePassword: dbPass, source: 'db' };
    }
    const envId = String(process.env.SSLCOMMERZ_LIVE_STORE_ID || '').trim();
    const envPass = String(process.env.SSLCOMMERZ_LIVE_STORE_PASSWORD || '').trim();
    if (envId && envPass) {
      return { mode, storeId: envId, storePassword: envPass, source: 'env' };
    }
  } else {
    const dbId = String(settings?.sandboxId || '').trim();
    const dbPass = String(settings?.sandboxPass || '').trim();
    if (dbId && dbPass) {
      return { mode, storeId: dbId, storePassword: dbPass, source: 'db' };
    }
    const envId = String(process.env.SSLCOMMERZ_SANDBOX_STORE_ID || '').trim();
    const envPass = String(process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD || '').trim();
    if (envId && envPass) {
      return { mode, storeId: envId, storePassword: envPass, source: 'env' };
    }
  }

  // Legacy single-pair fallback (one release)
  const legacyDbId = String(settings?.legacyId || '').trim();
  const legacyDbPass = String(settings?.legacyPass || '').trim();
  if (legacyDbId && legacyDbPass) {
    return { mode, storeId: legacyDbId, storePassword: legacyDbPass, source: 'legacy' };
  }
  const legacyEnvId = String(process.env.SSLCOMMERZ_STORE_ID || '').trim();
  const legacyEnvPass = String(process.env.SSLCOMMERZ_STORE_PASSWORD || '').trim();
  if (legacyEnvId && legacyEnvPass) {
    return { mode, storeId: legacyEnvId, storePassword: legacyEnvPass, source: 'legacy' };
  }

  return { mode, storeId: '', storePassword: '', source: 'env' };
}

export async function isSslConfigured(): Promise<boolean> {
  const creds = await resolveSslCredentials();
  return Boolean(creds.storeId && creds.storePassword);
}

export async function getSslPublicConfig(): Promise<SslPublicConfig> {
  const creds = await resolveSslCredentials();
  const embedScriptUrl =
    creds.mode === 'live'
      ? 'https://seamless-epay.sslcommerz.com/embed.min.js'
      : 'https://sandbox.sslcommerz.com/embed.min.js';
  return {
    mode: creds.mode,
    embedScriptUrl,
    configured: Boolean(creds.storeId && creds.storePassword),
  };
}

async function getClient(): Promise<{ client: SSLCommerzPayment; creds: SslResolvedCredentials }> {
  const creds = await resolveSslCredentials();
  if (!creds.storeId || !creds.storePassword) {
    throw new Error('SSLCommerz credentials not configured');
  }
  const client = new SSLCommerzPayment(creds.storeId, creds.storePassword, creds.mode === 'live');
  return { client, creds };
}

function pickAddress(primary?: SslCustomerAddress, fallbackName?: string, fallbackPhone?: string) {
  return {
    name: (primary?.name || fallbackName || 'Customer').slice(0, 50),
    add1: (primary?.line1 || 'Dhaka').slice(0, 50),
    add2: (primary?.line2 || primary?.city || 'Dhaka').slice(0, 50),
    city: (primary?.city || 'Dhaka').slice(0, 50),
    state: (primary?.state || primary?.city || 'Dhaka').slice(0, 50),
    postcode: String(primary?.postcode || '1000').slice(0, 30),
    country: (primary?.country || 'Bangladesh').slice(0, 50),
    phone: (primary?.phone || fallbackPhone || '01700000000').slice(0, 20),
  };
}

export async function initiatePayment(p: SslInitPayload): Promise<SslInitResult> {
  const { client } = await getClient();
  const cus = pickAddress(p.customerAddress, p.customerName, p.customerPhone);
  const ship = pickAddress(p.shippingAddress || p.customerAddress, p.customerName, p.customerPhone);
  const hasShip = Boolean(p.shippingAddress?.line1 || p.customerAddress?.line1);

  const data = {
    total_amount: p.amount,
    currency: 'BDT',
    tran_id: p.transactionId,
    success_url: `${API_BASE}/api/payments/sslcommerz/success`,
    fail_url: `${API_BASE}/api/payments/sslcommerz/fail`,
    cancel_url: `${API_BASE}/api/payments/sslcommerz/cancel`,
    ipn_url: `${API_BASE}/api/payments/sslcommerz/ipn`,
    shipping_method: hasShip ? 'YES' : 'NO',
    num_of_item: Math.max(1, Number(p.numOfItem) || 1),
    product_name: (p.productName || `Order ${p.orderNumber}`).slice(0, 255),
    product_category: 'General',
    product_profile: 'general',
    cus_name: cus.name,
    cus_email: (p.customerEmail || 'customer@oceanbazar.com').slice(0, 50),
    cus_add1: cus.add1,
    cus_add2: cus.add2,
    cus_city: cus.city,
    cus_state: cus.state,
    cus_postcode: cus.postcode,
    cus_country: cus.country,
    cus_phone: cus.phone,
    ship_name: ship.name,
    ship_add1: ship.add1,
    ship_add2: ship.add2,
    ship_city: ship.city,
    ship_state: ship.state,
    ship_postcode: ship.postcode,
    ship_country: ship.country,
    value_a: p.orderNumber,
    value_b: p.transactionId,
  };

  const res = await client.init(data);
  const gatewayPageURL = String(res.GatewayPageURL || '');
  if (res.status !== 'SUCCESS' || !gatewayPageURL) {
    throw new Error(String(res.failedreason || 'SSLCommerz init failed'));
  }
  return {
    gatewayPageURL,
    storeLogo: res.storeLogo ? String(res.storeLogo) : undefined,
    sessionkey: res.sessionkey ? String(res.sessionkey) : undefined,
    raw: res as Record<string, unknown>,
  };
}

export async function verifyIpnHash(body: Record<string, string>): Promise<boolean> {
  const creds = await resolveSslCredentials();
  if (!creds.storePassword) return false;
  const verifyKey = body.verify_key;
  const verifySign = body.verify_sign;
  if (!verifyKey || !verifySign) return false;

  const keys = verifyKey.split(',').map((k) => k.trim()).filter(Boolean);
  const hashString = keys.map((key) => `${key}=${body[key] ?? ''}`).join('&');
  const computed = crypto
    .createHash('md5')
    .update(hashString + creds.storePassword)
    .digest('hex');
  return computed === verifySign;
}

export async function validatePayment(valId: string): Promise<SslValidationResult> {
  const { client } = await getClient();
  const data = (await client.validate({ val_id: valId })) as Record<string, unknown>;
  const isValid = data.status === 'VALID' || data.status === 'VALIDATED';
  return {
    isValid,
    tranId: String(data.tran_id || ''),
    amount: parseFloat(String(data.amount ?? '0')),
    currency: String(data.currency || 'BDT'),
    bankTranId: data.bank_tran_id ? String(data.bank_tran_id) : undefined,
    cardType: data.card_type ? String(data.card_type) : undefined,
    valId: data.val_id ? String(data.val_id) : valId,
    raw: data,
  };
}

export async function queryTransactionById(tranId: string): Promise<unknown> {
  const { client } = await getClient();
  return client.transactionQueryByTransactionId({ tran_id: tranId });
}

export async function queryTransactionBySession(sessionKey: string): Promise<unknown> {
  const { client } = await getClient();
  return client.transactionQueryBySessionId({ sessionkey: sessionKey });
}

/**
 * Initiate refund including refund_trans_id (required by SSLCommerz as of 2025-02-24).
 * Uses direct GET because sslcommerz-lts does not send refund_trans_id yet.
 */
export async function initiateRefund(params: SslRefundParams): Promise<Record<string, unknown>> {
  const creds = await resolveSslCredentials();
  if (!creds.storeId || !creds.storePassword) {
    throw new Error('SSLCommerz credentials not configured');
  }
  const base =
    creds.mode === 'live'
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  const url = new URL(`${base}/validator/api/merchantTransIDvalidationAPI.php`);
  url.searchParams.set('bank_tran_id', params.bankTranId);
  url.searchParams.set('refund_trans_id', params.refundTransId);
  url.searchParams.set('refund_amount', String(params.refundAmount));
  url.searchParams.set('refund_remarks', params.refundRemarks || 'Refund');
  url.searchParams.set('store_id', creds.storeId);
  url.searchParams.set('store_passwd', creds.storePassword);
  url.searchParams.set('refe_id', params.refeId || params.refundTransId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('v', '1');

  const res = await fetch(url.toString(), { method: 'GET' });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`SSLCommerz refund response parse failed: ${text.slice(0, 200)}`);
  }
}

export async function refundQuery(refundRefId: string): Promise<Record<string, unknown>> {
  const { client } = await getClient();
  return (await client.refundQuery({ refund_ref_id: refundRefId })) as Record<string, unknown>;
}

/** Lightweight connectivity check for admin UI (does not create a real payment). */
export async function testSslConnection(): Promise<{ ok: boolean; mode: SslMode; message: string }> {
  try {
    const creds = await resolveSslCredentials();
    if (!creds.storeId || !creds.storePassword) {
      return { ok: false, mode: creds.mode, message: 'Credentials missing for active mode' };
    }
    // Query a nonsense session — auth success/failure tells us credentials are accepted.
    const result = (await queryTransactionBySession('OB_CREDENTIAL_TEST')) as Record<string, unknown>;
    const apiConnect = String(result.APIConnect || result.status || '');
    if (apiConnect === 'FAILED' || apiConnect === 'INACTIVE') {
      return { ok: false, mode: creds.mode, message: `API auth failed (${apiConnect})` };
    }
    return {
      ok: true,
      mode: creds.mode,
      message: `Connected (${creds.mode}) via ${creds.source}. Store ID: ${creds.storeId}`,
    };
  } catch (err: any) {
    const creds = await resolveSslCredentials().catch(() => ({ mode: 'sandbox' as SslMode }));
    return {
      ok: false,
      mode: creds.mode,
      message: err?.message || 'Connection test failed',
    };
  }
}
