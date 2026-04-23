import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

function getConfig() {
  const isSandbox = (process.env.PATHAO_ENV || 'sandbox') === 'sandbox';
  return {
    baseUrl: process.env.PATHAO_BASE_URL || (isSandbox
      ? 'https://courier-api-sandbox.pathao.com'
      : 'https://api-hermes.pathao.com'),
    clientId: process.env.PATHAO_CLIENT_ID || (isSandbox ? '7N1aMJQbWm' : 'Vyb8oXlavA'),
    clientSecret: process.env.PATHAO_CLIENT_SECRET || (isSandbox
      ? 'wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39'
      : '8UweXxp0aVYWR5bWQNg9zolnMMuDtziCZi2b3WEu'),
    username: process.env.PATHAO_USERNAME || (isSandbox ? 'test@pathao.com' : 'oceanbazar04@gmail.com'),
    password: process.env.PATHAO_PASSWORD || (isSandbox ? 'lovePathao' : '*#Ocean123'),
  };
}

async function getStoredToken(): Promise<{ access_token: string; refresh_token: string; expires_at: Date } | null> {
  const row = await prisma.courier_tokens.findFirst({ where: { provider: 'pathao' } });
  if (!row) return null;
  return { access_token: row.access_token, refresh_token: row.refresh_token || '', expires_at: row.expires_at };
}

async function storeToken(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  await prisma.courier_tokens.upsert({
    where: { provider: 'pathao' },
    create: {
      id: uuidv4(),
      provider: 'pathao',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    },
    update: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      updated_at: new Date(),
    },
  });
}

async function issueToken(): Promise<string> {
  const cfg = getConfig();
  const { data } = await axios.post(`${cfg.baseUrl}/aladdin/api/v1/issue-token`, {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    username: cfg.username,
    password: cfg.password,
    grant_type: 'password',
  });

  await storeToken(data.access_token, data.refresh_token, data.expires_in || 3600);
  return data.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const cfg = getConfig();
  try {
    const { data } = await axios.post(`${cfg.baseUrl}/aladdin/api/v1/issue-token`, {
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    await storeToken(data.access_token, data.refresh_token, data.expires_in || 3600);
    return data.access_token;
  } catch {
    return issueToken();
  }
}

export async function ensureToken(): Promise<string> {
  const stored = await getStoredToken();
  if (!stored) return issueToken();

  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 min before expiry
  if (stored.expires_at.getTime() - bufferMs < now.getTime()) {
    if (stored.refresh_token) {
      return refreshAccessToken(stored.refresh_token);
    }
    return issueToken();
  }
  return stored.access_token;
}

function getAuthClient(token: string): AxiosInstance {
  const cfg = getConfig();
  return axios.create({
    baseURL: cfg.baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

// ─── Store endpoints ─────────────────────────────────────────────────────────

export async function getStores(): Promise<any> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.get('/aladdin/api/v1/stores');
  return data.data;
}

export async function createStore(storeData: {
  name: string;
  contact_name: string;
  contact_number: string;
  address: string;
  city_id: number;
  zone_id: number;
  area_id: number;
}): Promise<any> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.post('/aladdin/api/v1/stores', storeData);
  return data.data;
}

// ─── Geo endpoints ──────────────────────────────────────────────────────────

export async function getCities(): Promise<any[]> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.get('/aladdin/api/v1/countries/1/city-list');
  return data.data?.data || data.data || [];
}

export async function getZones(cityId: number): Promise<any[]> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.get(`/aladdin/api/v1/cities/${cityId}/zone-list`);
  return data.data?.data || data.data || [];
}

export async function getAreas(zoneId: number): Promise<any[]> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.get(`/aladdin/api/v1/zones/${zoneId}/area-list`);
  return data.data?.data || data.data || [];
}

// ─── Order endpoints ─────────────────────────────────────────────────────────

export interface PathaoOrderInput {
  store_id: number;
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city: number;
  recipient_zone: number;
  recipient_area?: number;
  delivery_type: number; // 48 = normal, 12 = on demand
  item_type: number; // 1 = document, 2 = parcel
  special_instruction?: string;
  item_quantity: number;
  item_weight: number;
  amount_to_collect: number; // COD amount, 0 for prepaid
  item_description?: string;
}

export interface PathaoOrderResult {
  success: boolean;
  consignment_id?: string;
  merchant_order_id?: string;
  order_status?: string;
  delivery_fee?: number;
  message?: string;
  raw?: any;
}

export async function createOrder(input: PathaoOrderInput): Promise<PathaoOrderResult> {
  try {
    const token = await ensureToken();
    const client = getAuthClient(token);
    const { data } = await client.post('/aladdin/api/v1/orders', input);

    return {
      success: true,
      consignment_id: data.data?.consignment_id,
      merchant_order_id: data.data?.merchant_order_id,
      order_status: data.data?.order_status,
      delivery_fee: data.data?.delivery_fee,
      raw: data.data,
    };
  } catch (err: any) {
    console.error('[pathao] createOrder error:', err.response?.data || err.message);
    return {
      success: false,
      message: err.response?.data?.message || err.message,
    };
  }
}

export async function getOrderInfo(consignmentId: string): Promise<any> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.get(`/aladdin/api/v1/orders/${consignmentId}/info`);
  return data.data;
}

// ─── Price estimation ────────────────────────────────────────────────────────

export async function calculatePrice(params: {
  store_id: number;
  item_type: number;
  delivery_type: number;
  item_weight: number;
  recipient_city: number;
  recipient_zone: number;
}): Promise<{ price: number; discount?: number; raw?: any }> {
  const token = await ensureToken();
  const client = getAuthClient(token);
  const { data } = await client.post('/aladdin/api/v1/merchant/price-plan', params);
  return {
    price: data.data?.price || 0,
    discount: data.data?.discount,
    raw: data.data,
  };
}

/** Maps Pathao order statuses to internal statuses */
export function mapPathaoStatus(status: string): string {
  const map: Record<string, string> = {
    Pending: 'pending',
    Pickup_Requested: 'pending',
    Assigned_for_Pickup: 'pending',
    Picked: 'picked_up',
    In_Transit: 'in_transit',
    Pickup_Failed: 'pending',
    Return: 'returned',
    Delivered: 'delivered',
    Partial_Delivered: 'partial_delivery',
    On_Hold: 'on_hold',
    Payment_Invoice: 'delivered',
  };
  return map[status] || 'in_transit';
}
