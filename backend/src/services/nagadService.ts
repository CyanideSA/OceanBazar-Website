/**
 * Nagad Payment Gateway Service
 * Docs: https://developer.nagad.com.bd/
 *
 * Required env vars:
 *   NAGAD_MERCHANT_ID
 *   NAGAD_MERCHANT_PRIVATE_KEY  (Base64-encoded RSA private key)
 *   NAGAD_PGW_PUBLIC_KEY        (Base64-encoded Nagad public key)
 *   NAGAD_BASE_URL              (sandbox: http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0)
 *   API_BASE_URL                (your backend URL)
 */

import axios from 'axios';
import crypto from 'crypto';

const MERCHANT_ID = process.env.NAGAD_MERCHANT_ID || '';
const PRIVATE_KEY = process.env.NAGAD_MERCHANT_PRIVATE_KEY || '';
const PGW_PUBLIC_KEY = process.env.NAGAD_PGW_PUBLIC_KEY || '';
const BASE_URL = process.env.NAGAD_BASE_URL || 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0';

export function isNagadConfigured(): boolean {
  return !!(MERCHANT_ID && PRIVATE_KEY && PGW_PUBLIC_KEY);
}

function encryptWithPublicKey(data: string): string {
  const pubKey = `-----BEGIN PUBLIC KEY-----\n${PGW_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  return crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(data)
  ).toString('base64');
}

function signWithPrivateKey(data: string): string {
  const privKey = `-----BEGIN RSA PRIVATE KEY-----\n${PRIVATE_KEY}\n-----END RSA PRIVATE KEY-----`;
  const signer = crypto.createSign('SHA256');
  signer.update(data);
  return signer.sign(privKey, 'base64');
}

export async function createPayment(params: {
  orderId: string;
  orderNumber: string;
  amount: number;
}): Promise<{ callBackUrl: string }> {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const challengeTimestamp = timestamp;

  const sensitiveData = {
    merchantId: MERCHANT_ID,
    datetime: challengeTimestamp,
    orderId: params.orderNumber,
    challenge: encryptWithPublicKey(challengeTimestamp),
  };

  const initRes = await axios.post(
    `${BASE_URL}/api/dfs/check-out/initialize/${MERCHANT_ID}/${params.orderNumber}`,
    {
      datetime: challengeTimestamp,
      sensitiveData: JSON.stringify(sensitiveData),
      signature: signWithPrivateKey(JSON.stringify(sensitiveData)),
    },
    {
      headers: {
        'X-KM-IP-V4': '127.0.0.1',
        'X-KM-MC-Id': MERCHANT_ID,
        'X-KM-Password': encryptWithPublicKey(MERCHANT_ID),
        'X-KM-Client-Type': 'PC_WEB',
        'content-type': 'application/json',
      },
      timeout: 15_000,
    }
  );

  if (initRes.data.reason !== 'Success') {
    throw new Error(`Nagad init error: ${initRes.data.reason}`);
  }

  const tokenData = JSON.parse(Buffer.from(initRes.data.sensitiveData, 'base64').toString());
  const tokenStr = tokenData.tokenId;

  const completeData = {
    merchantId: MERCHANT_ID,
    orderId: params.orderNumber,
    currencyCode: '050',
    amount: params.amount.toFixed(2),
    challenge: tokenStr,
  };

  const completeRes = await axios.post(
    `${BASE_URL}/api/dfs/check-out/complete/${MERCHANT_ID}/${params.orderNumber}`,
    {
      sensitiveData: encryptWithPublicKey(JSON.stringify(completeData)),
      signature: signWithPrivateKey(JSON.stringify(completeData)),
      merchantCallbackURL: `${apiBase}/api/payments/nagad/callback`,
      additionalMerchantInfo: { orderId: params.orderId },
    },
    {
      headers: {
        'X-KM-IP-V4': '127.0.0.1',
        'X-KM-MC-Id': MERCHANT_ID,
        'X-KM-Password': encryptWithPublicKey(MERCHANT_ID),
        'X-KM-Client-Type': 'PC_WEB',
        'content-type': 'application/json',
      },
      timeout: 15_000,
    }
  );

  if (!completeRes.data.callBackUrl) {
    throw new Error(`Nagad complete error: ${JSON.stringify(completeRes.data)}`);
  }

  return { callBackUrl: completeRes.data.callBackUrl };
}
