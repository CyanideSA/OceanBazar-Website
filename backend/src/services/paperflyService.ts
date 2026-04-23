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

export interface PaperflyOrderInput {
  merOrderRef: string;
  pickMerchantName: string;
  pickMerchantAddress: string;
  pickMerchantThana: string;
  pickMerchantDistrict: string;
  pickphnNumber: string;
  productSizeWeight: string; // e.g. "standard"
  productBrief: string;
  packagePrice: number;
  paymentMethod: string; // "COD" | "PREPAID"
  custname: string;
  custaddress: string;
  customerThana: string;
  customerDistrict: string;
  custPhone: string;
  max_weight?: string;
}

export interface PaperflyOrderResult {
  success: boolean;
  referenceNumber?: string;
  message?: string;
  raw?: any;
}

export async function createOrder(input: PaperflyOrderInput): Promise<PaperflyOrderResult> {
  try {
    const client = getClient();
    const payload = {
      merOrderRef: input.merOrderRef,
      pickMerchantName: input.pickMerchantName,
      pickMerchantAddress: input.pickMerchantAddress,
      pickMerchantThana: input.pickMerchantThana,
      pickMerchantDistrict: input.pickMerchantDistrict,
      pickphnNumber: input.pickphnNumber,
      productSizeWeight: input.productSizeWeight || 'standard',
      productBrief: input.productBrief,
      packagePrice: String(input.packagePrice),
      max_weight: input.max_weight || '0.5',
      paymentMethod: input.paymentMethod,
      custname: input.custname,
      custaddress: input.custaddress,
      customerThana: input.customerThana,
      customerDistrict: input.customerDistrict,
      custPhone: input.custPhone,
    };

    const { data } = await client.post('/merchant/api/service/new_order_v2.php', payload);

    return {
      success: !!data?.success || data?.orderid,
      referenceNumber: data?.orderid || data?.referenceNumber,
      message: data?.message,
      raw: data,
    };
  } catch (err: any) {
    console.error('[paperfly] createOrder error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

export interface PaperflyTrackResult {
  success: boolean;
  status?: string;
  events?: any[];
  raw?: any;
}

export async function trackOrder(referenceNumber: string): Promise<PaperflyTrackResult> {
  try {
    const client = getClient();
    const { data } = await client.post('/API-Order-Tracking', {
      ReferenceNumber: referenceNumber,
    });

    return {
      success: true,
      status: data?.currentStatus || data?.status,
      events: data?.events || data?.trackingHistory || [],
      raw: data,
    };
  } catch (err: any) {
    console.error('[paperfly] trackOrder error:', err.response?.data || err.message);
    return { success: false };
  }
}

export async function cancelOrder(referenceNumber: string): Promise<{ success: boolean; message?: string }> {
  try {
    const client = getClient();
    const { data } = await client.post('/api/v1/cancel-order', {
      referenceNumber,
    });
    return { success: !!data?.success, message: data?.message };
  } catch (err: any) {
    console.error('[paperfly] cancelOrder error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

/** Maps Paperfly webhook event types to internal shipment statuses */
export function mapPaperflyStatus(eventType: string): string {
  const map: Record<string, string> = {
    'parcel.created': 'pending',
    'parcel.cancelled': 'cancelled',
    'parcel.picked_up': 'picked_up',
    'parcel.in_transit': 'in_transit',
    'parcel.received_at_point': 'in_transit',
    'parcel.assigned_for_delivery': 'out_for_delivery',
    'parcel.delivered': 'delivered',
    'parcel.partial': 'partial_delivery',
    'parcel.exchange': 'exchange',
    'parcel.on_hold': 'on_hold',
    'parcel.return': 'returned',
    'parcel.return_transit': 'return_in_transit',
    'parcel.return_to_merchant': 'returned',
  };
  return map[eventType] || 'in_transit';
}
