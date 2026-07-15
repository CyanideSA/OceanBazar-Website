/**
 * bKash Payment Gateway Service (Tokenized Checkout)
 * Docs: https://developer.bka.sh/docs/tokenized-checkout-process
 *
 * Required env vars:
 *   BKASH_APP_KEY, BKASH_APP_SECRET
 *   BKASH_USERNAME, BKASH_PASSWORD
 *   BKASH_BASE_URL (e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta for sandbox)
 */

import axios from 'axios';

const BASE = process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
const APP_KEY = process.env.BKASH_APP_KEY || '';
const APP_SECRET = process.env.BKASH_APP_SECRET || '';
const USERNAME = process.env.BKASH_USERNAME || '';
const PASSWORD = process.env.BKASH_PASSWORD || '';

export function isBkashConfigured(): boolean {
  return !!(APP_KEY && APP_SECRET && USERNAME && PASSWORD);
}

let cachedToken: { id_token: string; expires_at: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.id_token;
  }
  const res = await axios.post(
    `${BASE}/tokenized/checkout/token/grant`,
    { app_key: APP_KEY, app_secret: APP_SECRET },
    {
      headers: {
        accept: 'application/json',
        username: USERNAME,
        password: PASSWORD,
        'content-type': 'application/json',
      },
      timeout: 10_000,
    }
  );
  if (res.data.statusCode !== '0000') {
    throw new Error(`bKash token error: ${res.data.statusMessage}`);
  }
  cachedToken = {
    id_token: res.data.id_token,
    expires_at: Date.now() + (res.data.expires_in ? res.data.expires_in * 1000 : 3_600_000),
  };
  return cachedToken.id_token;
}

export async function createPayment(params: {
  amount: number;
  orderId: string;
  orderNumber: string;
  callbackURL: string;
  cancelledURL?: string;
}): Promise<{ paymentID: string; bkashURL: string }> {
  const token = await getToken();
  const res = await axios.post(
    `${BASE}/tokenized/checkout/create`,
    {
      mode: '0011',
      payerReference: params.orderId,
      callbackURL: params.callbackURL,
      cancelledURL: params.cancelledURL || params.callbackURL,
      amount: params.amount.toFixed(2),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: params.orderNumber,
    },
    {
      headers: {
        accept: 'application/json',
        authorization: token,
        'x-app-key': APP_KEY,
        'content-type': 'application/json',
      },
      timeout: 15_000,
    }
  );
  if (res.data.statusCode !== '0000') {
    throw new Error(`bKash create payment error: ${res.data.statusMessage}`);
  }
  return { paymentID: res.data.paymentID, bkashURL: res.data.bkashURL };
}

export async function executePayment(paymentID: string): Promise<{
  trxID: string;
  transactionStatus: string;
  amount: string;
}> {
  const token = await getToken();
  const res = await axios.post(
    `${BASE}/tokenized/checkout/execute`,
    { paymentID },
    {
      headers: {
        accept: 'application/json',
        authorization: token,
        'x-app-key': APP_KEY,
        'content-type': 'application/json',
      },
      timeout: 15_000,
    }
  );
  if (res.data.statusCode !== '0000') {
    throw new Error(`bKash execute error: ${res.data.statusMessage}`);
  }
  return {
    trxID: res.data.trxID,
    transactionStatus: res.data.transactionStatus,
    amount: res.data.amount,
  };
}

export async function queryPayment(paymentID: string): Promise<{
  transactionStatus: string;
  trxID?: string;
  amount?: string;
}> {
  const token = await getToken();
  const res = await axios.post(
    `${BASE}/tokenized/checkout/payment/status`,
    { paymentID },
    {
      headers: {
        accept: 'application/json',
        authorization: token,
        'x-app-key': APP_KEY,
        'content-type': 'application/json',
      },
      timeout: 10_000,
    }
  );
  return {
    transactionStatus: res.data.transactionStatus,
    trxID: res.data.trxID,
    amount: res.data.amount,
  };
}
