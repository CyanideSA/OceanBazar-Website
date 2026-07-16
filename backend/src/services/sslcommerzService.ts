import crypto from 'crypto';
import SSLCommerzPayment from 'sslcommerz-lts';

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID || '';
const STORE_PASSWORD = process.env.SSLCOMMERZ_STORE_PASSWORD || '';
const SANDBOX = process.env.SSLCOMMERZ_SANDBOX !== 'false';
const API_BASE = (process.env.API_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export function isSslConfigured(): boolean {
  return Boolean(STORE_ID && STORE_PASSWORD);
}

function getClient(): SSLCommerzPayment {
  if (!isSslConfigured()) {
    throw new Error('SSLCommerz credentials not configured');
  }
  return new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, !SANDBOX);
}

export interface SslInitPayload {
  transactionId: string;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export async function initiatePayment(p: SslInitPayload): Promise<string> {
  const sslcz = getClient();
  const data = {
    total_amount: p.amount,
    currency: 'BDT',
    tran_id: p.transactionId,
    success_url: `${API_BASE}/api/payments/sslcommerz/success`,
    fail_url: `${API_BASE}/api/payments/sslcommerz/fail`,
    cancel_url: `${API_BASE}/api/payments/sslcommerz/cancel`,
    ipn_url: `${API_BASE}/api/payments/sslcommerz/ipn`,
    shipping_method: 'NO',
    num_of_item: 1,
    product_name: `Order ${p.orderNumber}`,
    product_category: 'General',
    product_profile: 'general',
    cus_name: p.customerName || 'Customer',
    cus_email: p.customerEmail || 'customer@oceanbazar.com',
    cus_add1: 'Dhaka',
    cus_add2: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: p.customerPhone || '01700000000',
    value_a: p.orderNumber,
    value_b: p.transactionId,
  };

  const res = await sslcz.init(data);
  if (res.status !== 'SUCCESS' || !res.GatewayPageURL) {
    throw new Error(res.failedreason || 'SSLCommerz init failed');
  }
  return res.GatewayPageURL;
}

export function verifyIpnHash(body: Record<string, string>): boolean {
  if (!STORE_PASSWORD) return false;
  const verifyKey = body.verify_key;
  const verifySign = body.verify_sign;
  if (!verifyKey || !verifySign) return false;

  const keys = verifyKey.split(',').map((k) => k.trim()).filter(Boolean);
  const hashString = keys
    .map((key) => `${key}=${body[key] ?? ''}`)
    .join('&');
  const computed = crypto
    .createHash('md5')
    .update(hashString + STORE_PASSWORD)
    .digest('hex');
  return computed === verifySign;
}

export interface SslValidationResult {
  isValid: boolean;
  tranId: string;
  amount: number;
  currency: string;
  bankTranId?: string;
  cardType?: string;
  raw: Record<string, unknown>;
}

export async function validatePayment(valId: string): Promise<SslValidationResult> {
  const sslcz = getClient();
  const data = await sslcz.validate({ val_id: valId });
  const isValid = data.status === 'VALID' || data.status === 'VALIDATED';
  return {
    isValid,
    tranId: String(data.tran_id || ''),
    amount: parseFloat(String(data.amount ?? '0')),
    currency: String(data.currency || 'BDT'),
    bankTranId: data.bank_tran_id ? String(data.bank_tran_id) : undefined,
    cardType: data.card_type ? String(data.card_type) : undefined,
    raw: data as Record<string, unknown>,
  };
}

export async function queryTransactionById(tranId: string): Promise<unknown> {
  const sslcz = getClient();
  return sslcz.transactionQueryByTransactionId({ tran_id: tranId });
}

export async function queryTransactionBySession(sessionKey: string): Promise<unknown> {
  const sslcz = getClient();
  return sslcz.transactionQueryBySessionId({ sessionkey: sessionKey });
}
