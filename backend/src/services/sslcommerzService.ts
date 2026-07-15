/**
 * SSLCommerz Payment Gateway Service
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * Required env vars:
 *   SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD
 *   SSLCOMMERZ_SANDBOX  (true = sandbox, false = production)
 *   API_BASE_URL        (your backend URL, e.g. https://api.oceanbazar.com)
 *   CLIENT_URL          (storefront URL, e.g. https://oceanbazar.com)
 */

import axios from 'axios';
import crypto from 'crypto';

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID || '';
const STORE_PASS = process.env.SSLCOMMERZ_STORE_PASSWORD || '';
const IS_SANDBOX = process.env.SSLCOMMERZ_SANDBOX !== 'false';

const GATEWAY_URL = IS_SANDBOX
  ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
  : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

const VALIDATE_URL = IS_SANDBOX
  ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
  : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

export function isSslConfigured(): boolean {
  return !!(STORE_ID && STORE_PASS);
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
  const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const params = new URLSearchParams({
    store_id: STORE_ID,
    store_passwd: STORE_PASS,
    total_amount: p.amount.toFixed(2),
    currency: 'BDT',
    tran_id: p.transactionId,
    success_url: `${apiBase}/api/payments/sslcommerz/success`,
    fail_url: `${apiBase}/api/payments/sslcommerz/fail`,
    cancel_url: `${clientUrl}/en/checkout`,
    ipn_url: `${apiBase}/api/payments/sslcommerz/ipn`,
    cus_name: p.customerName || 'Customer',
    cus_email: p.customerEmail || 'customer@oceanbazar.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
    cus_phone: p.customerPhone || '01700000000',
    shipping_method: 'NO',
    product_name: `OceanBazar Order #${p.orderNumber}`,
    product_category: 'General',
    product_profile: 'general',
    emi_option: '0',
  });

  const res = await axios.post(GATEWAY_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });

  if (res.data.status !== 'SUCCESS' || !res.data.GatewayPageURL) {
    throw new Error(`SSLCommerz init error: ${res.data.failedreason || res.data.status}`);
  }

  return res.data.GatewayPageURL;
}

/**
 * Verify SSLCommerz IPN signature (MD5-based).
 * Sort all POST fields alphabetically (excluding verify_sign + verify_sign_sha2),
 * append store password hash, then MD5 the whole string.
 */
export function verifyIpnHash(body: Record<string, string>): boolean {
  const { verify_sign, verify_sign_sha2, ...rest } = body;
  if (!verify_sign) return false;
  const sorted = Object.keys(rest).sort();
  const parts = sorted.map((k) => `${k}=${rest[k] ?? ''}`);
  parts.push(`store_passwd=${crypto.createHash('md5').update(STORE_PASS).digest('hex')}`);
  const hash = crypto.createHash('md5').update(parts.join('&')).digest('hex');
  return hash === verify_sign;
}

export async function validatePayment(valId: string): Promise<{ isValid: boolean; amount: string; tranId: string }> {
  const res = await axios.get(VALIDATE_URL, {
    params: {
      val_id: valId,
      store_id: STORE_ID,
      store_passwd: STORE_PASS,
      v: 1,
      format: 'json',
    },
    timeout: 10_000,
  });

  return {
    isValid: res.data.status === 'VALID' || res.data.status === 'VALIDATED',
    amount: String(res.data.amount || '0'),
    tranId: String(res.data.tran_id || ''),
  };
}
