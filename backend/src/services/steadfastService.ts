import axios, { AxiosInstance } from 'axios';

const STEADFAST_BASE = 'https://portal.packzy.com/api/v1';

function getClient(): AxiosInstance {
  return axios.create({
    baseURL: process.env.STEADFAST_BASE_URL || STEADFAST_BASE,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.STEADFAST_API_KEY || 'xbickzb9xcwvtvhygrxiqqhfctnmfcmu',
      'Secret-Key': process.env.STEADFAST_SECRET_KEY || '89ndw5qrp8nlbxecofx76agc',
    },
  });
}

// ─── Order Creation ──────────────────────────────────────────────────────────

export interface SteadfastOrderInput {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
}

export interface SteadfastOrderResult {
  success: boolean;
  consignment_id?: string;
  tracking_code?: string;
  invoice?: string;
  status?: string;
  delivery_fee?: number;
  message?: string;
  raw?: any;
}

export async function createOrder(input: SteadfastOrderInput): Promise<SteadfastOrderResult> {
  try {
    const client = getClient();
    const { data } = await client.post('/create_order', input);

    return {
      success: data.status === 200 || data.status === 'success',
      consignment_id: String(data.consignment?.consignment_id || ''),
      tracking_code: data.consignment?.tracking_code,
      invoice: data.consignment?.invoice,
      status: data.consignment?.status,
      delivery_fee: data.consignment?.delivery_fee,
      message: data.message,
      raw: data,
    };
  } catch (err: any) {
    console.error('[steadfast] createOrder error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

export async function bulkCreateOrders(orders: SteadfastOrderInput[]): Promise<{
  success: boolean;
  results?: any[];
  message?: string;
}> {
  try {
    const client = getClient();
    const { data } = await client.post('/create_order/bulk-order', { data: orders });
    return {
      success: data.status === 200 || data.status === 'success',
      results: data.consignments || data.data,
      message: data.message,
    };
  } catch (err: any) {
    console.error('[steadfast] bulkCreateOrders error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

// ─── Tracking / Status ───────────────────────────────────────────────────────

export async function getStatusByCid(consignmentId: string): Promise<any> {
  const client = getClient();
  const { data } = await client.get(`/status_by_cid/${consignmentId}`);
  return data.delivery_status || data;
}

export async function getStatusByInvoice(invoice: string): Promise<any> {
  const client = getClient();
  const { data } = await client.get(`/status_by_invoice/${invoice}`);
  return data.delivery_status || data;
}

export async function getStatusByTrackingCode(trackingCode: string): Promise<any> {
  const client = getClient();
  const { data } = await client.get(`/status_by_trackingcode/${trackingCode}`);
  return data.delivery_status || data;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export async function getBalance(): Promise<{ current_balance: number; raw?: any }> {
  const client = getClient();
  const { data } = await client.get('/get_balance');
  return { current_balance: data.current_balance || 0, raw: data };
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export async function createReturnRequest(params: {
  consignment_id: string;
  reason?: string;
}): Promise<{ success: boolean; message?: string; raw?: any }> {
  try {
    const client = getClient();
    const { data } = await client.post('/create_return_request', params);
    return { success: data.status === 200 || data.status === 'success', message: data.message, raw: data };
  } catch (err: any) {
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

export async function getReturnRequests(): Promise<any[]> {
  const client = getClient();
  const { data } = await client.get('/get_return_requests');
  return data.data || [];
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function getPayments(): Promise<any[]> {
  const client = getClient();
  const { data } = await client.get('/payments');
  return data.data || [];
}

export async function getPayment(id: string): Promise<any> {
  const client = getClient();
  const { data } = await client.get(`/payments/${id}`);
  return data.data || data;
}

/** Maps Steadfast delivery statuses to internal statuses */
export function mapSteadfastStatus(status: string): string {
  const normalized = String(status).toLowerCase().replace(/[_\s-]+/g, '_');
  const map: Record<string, string> = {
    pending: 'pending',
    delivered: 'delivered',
    delivered_to_customer: 'delivered',
    partial_delivered: 'partial_delivery',
    cancelled: 'cancelled',
    hold: 'on_hold',
    in_review: 'in_transit',
    unknown: 'in_transit',
    pickup_assigned: 'pending',
    pickup_re_schedule: 'pending',
    pickup_complete: 'picked_up',
    received_at_warehouse: 'in_transit',
    out_for_delivery: 'out_for_delivery',
    return: 'returned',
    return_to_merchant: 'returned',
  };
  return map[normalized] || 'in_transit';
}
