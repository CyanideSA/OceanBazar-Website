import axios, { AxiosInstance } from 'axios';

const PAPERFLY_BASE = 'https://api.paperfly.com.bd';

function getClient(): AxiosInstance {
  const username = process.env.PAPERFLY_USERNAME || 'c177020';
  const password = process.env.PAPERFLY_PASSWORD || '5710';
  const paperflyKey = process.env.PAPERFLY_KEY || 'Paperfly_~La?Rj73FcLm';

  return axios.create({
    baseURL: PAPERFLY_BASE,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      paperflykey: paperflyKey,
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
  });
}

// ─── Create Order (v2 API) ────────────────────────────────────────────────────
// POST /merchant/api/service/new_order_v2.php

export interface PaperflyOrderInput {
  merchantOrderReference: string; // unique merchant reference
  storeName: string;              // merchant/store name
  productBrief: string;           // product description
  packagePrice: string | number;  // COD amount
  max_weight: string;             // weight in KG e.g. "0.5"
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  // Exchange order fields (optional)
  orderType?: 'Exchange';
  exchangeDescription?: string;
  exchangePrice?: string | number;
  exchangeWeight?: string;
}

export interface PaperflyOrderResult {
  success: boolean;
  trackingNumber?: string;      // Z-051125-63821-A3-A1 format
  trackingBarcode?: string;     // numeric barcode
  message?: string;
  raw?: any;
}

export async function createOrder(input: PaperflyOrderInput): Promise<PaperflyOrderResult> {
  try {
    const client = getClient();
    const payload: Record<string, any> = {
      merchantOrderReference: input.merchantOrderReference,
      storeName: input.storeName || 'Oceanbazar',
      productBrief: String(input.productBrief || 'Product').slice(0, 200),
      packagePrice: String(input.packagePrice),
      max_weight: input.max_weight || '0.5',
      customerName: input.customerName,
      customerAddress: input.customerAddress,
      customerPhone: input.customerPhone,
    };

    // Exchange order fields
    if (input.orderType === 'Exchange') {
      payload.orderType = 'Exchange';
      payload.exchangeDescription = input.exchangeDescription || '';
      payload.exchangePrice = String(input.exchangePrice || '0');
      payload.exchangeWeight = input.exchangeWeight || '0.5';
    }

    const { data } = await client.post('/merchant/api/service/new_order_v2.php', payload);

    const trackingNumber = data?.success?.tracking_number || data?.tracking_number;
    const trackingBarcode = data?.success?.tracking_barcode || data?.tracking_barcode;

    return {
      success: data?.response_code === 200 || !!trackingNumber,
      trackingNumber,
      trackingBarcode,
      message: data?.success?.message || data?.message,
      raw: data,
    };
  } catch (err: any) {
    console.error('[paperfly] createOrder error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

// ─── Track Order ─────────────────────────────────────────────────────────────
// POST /API-Order-Tracking

export interface PaperflyTrackResult {
  success: boolean;
  status?: string;
  trackingStatus?: any;
  raw?: any;
}

export async function trackOrder(referenceNumber: string): Promise<PaperflyTrackResult> {
  try {
    const client = getClient();
    const { data } = await client.post('/API-Order-Tracking', {
      ReferenceNumber: referenceNumber,
    });

    return {
      success: data?.response_code === 200 || !!data?.success,
      trackingStatus: data?.success?.trackingStatus,
      raw: data,
    };
  } catch (err: any) {
    console.error('[paperfly] trackOrder error:', err.response?.data || err.message);
    return { success: false };
  }
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────
// POST /api/v1/cancel-order
// Body: { order_id: referenceNumber }

export async function cancelOrder(referenceNumber: string): Promise<{ success: boolean; message?: string }> {
  try {
    const client = getClient();
    const { data } = await client.post('/api/v1/cancel-order', {
      order_id: referenceNumber, // API expects "order_id" not "referenceNumber"
    });
    return {
      success: data?.success?.response_code === 200 || !!data?.success,
      message: data?.success?.message || data?.message,
    };
  } catch (err: any) {
    console.error('[paperfly] cancelOrder error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

// ─── Status Mapping — maps Paperfly webhook "event" field → internal status ──
// Paperfly webhook sends: { "event": "parcel.delivered", "data": { ... } }

export function mapPaperflyStatus(eventType: string): string {
  const map: Record<string, string> = {
    'parcel.created':             'pending',
    'parcel.cancelled':           'cancelled',
    'parcel.picked_up':           'picked_up',
    'parcel.in_transit':          'in_transit',
    'parcel.received_at_point':   'in_transit',
    'parcel.assigned_for_delivery': 'out_for_delivery',
    'parcel.delivered':           'delivered',
    'parcel.partial':             'partial_delivery',
    'parcel.exchange':            'exchange',
    'parcel.on_hold':             'on_hold',
    'parcel.return':              'returned',
    'parcel.return_transit':      'return_in_transit',
    'parcel.return_to_merchant':  'returned',
  };
  return map[eventType] || 'in_transit';
}
