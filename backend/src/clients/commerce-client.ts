import type { Request } from 'express';
import { internalApiRequest } from './internal-api-client';
import {
  CheckoutValidateResponseSchema,
  type CheckoutValidateResponse,
} from '../contracts/checkout.contract';

function forwardAuth(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h : undefined;
}

export type CheckoutValidateBody = {
  paymentMethod: string;
  couponCode?: string;
  obPointsToRedeem?: number;
  obBalance?: number;
  shippingAddressId?: number;
};

export async function validateCheckoutWithCore(
  req: Request,
  body: CheckoutValidateBody
): Promise<CheckoutValidateResponse> {
  return internalApiRequest({
    method: 'POST',
    path: '/api/checkout/validate',
    data: body,
    forwardAuth: forwardAuth(req),
    requestId: req.requestId,
    schema: CheckoutValidateResponseSchema,
  });
}

export type FulfillLine = {
  productId: string;
  variantId?: string;
  quantity: number;
};

export async function fulfillInventoryForOrder(
  req: Request,
  orderId: string,
  lines: FulfillLine[]
): Promise<{ orderId: string; linesProcessed: number; inventoryRowsUpdated: number }> {
  return internalApiRequest({
    method: 'POST',
    path: '/api/inventory/fulfill-placed-order',
    data: { orderId, lines },
    forwardAuth: forwardAuth(req),
    requestId: req.requestId,
  });
}

export async function proxyCartToCore(
  req: Request,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown
): Promise<unknown> {
  return internalApiRequest({
    method,
    path: `/api/cart${path}`,
    data,
    forwardAuth: forwardAuth(req),
    requestId: req.requestId,
  });
}

export function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  if (v && typeof v === 'object' && 'toNumber' in (v as object)) {
    return Number(String(v));
  }
  return Number(v);
}
