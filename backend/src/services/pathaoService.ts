import axios, { AxiosInstance } from 'axios';
import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';

type PathaoConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: number;
};

async function loadDbCredentials(): Promise<Partial<PathaoConfig>> {
  try {
    const row = await prisma.site_settings.findFirst({ where: { id: 'default' } });
    if (!row) return {};
    return {
      clientId: row.pathao_client_id || undefined,
      clientSecret: row.pathao_client_secret || undefined,
      storeId: row.pathao_store_id ? Number(row.pathao_store_id) : undefined,
    };
  } catch {
    return {};
  }
}

async function getConfig(): Promise<PathaoConfig> {
  const isSandbox = (process.env.PATHAO_ENV || 'sandbox') === 'sandbox';
  const db = await loadDbCredentials();
  const config: PathaoConfig = {
    baseUrl: process.env.PATHAO_BASE_URL || (isSandbox
      ? 'https://courier-api-sandbox.pathao.com'
      : 'https://api-hermes.pathao.com'),
    clientId: process.env.PATHAO_CLIENT_ID || db.clientId || '',
    clientSecret: process.env.PATHAO_CLIENT_SECRET || db.clientSecret || '',
    username: process.env.PATHAO_USERNAME || '',
    password: process.env.PATHAO_PASSWORD || '',
    storeId: Number(process.env.PATHAO_STORE_ID || db.storeId || 0) || 0,
  };

  if (!config.clientId || !config.clientSecret || !config.username || !config.password) {
    throw new Error('Pathao credentials are not configured (need client id/secret + username/password)');
  }
  return config;
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
  const cfg = await getConfig();
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
  const cfg = await getConfig();
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

async function getAuthClient(token: string): Promise<AxiosInstance> {
  const cfg = await getConfig();
  return axios.create({
    baseURL: cfg.baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

function unwrapList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

/** Pathao requires exactly 11 digits starting with 01 (e.g. 01712345678). */
export function normalizePathaoPhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length >= 12) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return digits;
}

export function assertPathaoPhone(phone: string): string {
  const normalized = normalizePathaoPhone(phone);
  if (!/^01\d{9}$/.test(normalized)) {
    throw new Error(
      `Pathao phone must be 11 digits starting with 01 (got "${normalized || 'empty'}"). Example: 01712345678`
    );
  }
  return normalized;
}

function clampPathaoWeight(kg: number): number {
  const n = Number(kg);
  if (!Number.isFinite(n) || n < 0.5) return 0.5;
  if (n > 10) return 10;
  return Math.round(n * 10) / 10;
}

function formatPathaoApiError(data: any, fallback: string): string {
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const parts = Object.entries(errors).flatMap(([field, msgs]) => {
      const list = Array.isArray(msgs) ? msgs : [String(msgs)];
      return list.map((m) => `${field}: ${m}`);
    });
    if (parts.length) return parts.join(' | ');
  }
  if (typeof data?.message === 'string' && data.message) return data.message;
  return fallback;
}

// ─── Store endpoints ─────────────────────────────────────────────────────────

export async function getStores(): Promise<any[]> {
  const token = await ensureToken();
  const client = await getAuthClient(token);
  const { data } = await client.get('/aladdin/api/v1/stores');
  return unwrapList(data?.data ?? data);
}

export async function getDefaultStoreId(): Promise<number> {
  const cfg = await getConfig();
  if (cfg.storeId > 0) return cfg.storeId;
  const stores = await getStores();
  const preferred = stores.find((s) => s.is_default_store) || stores[0];
  const id = Number(preferred?.store_id || preferred?.id || 0);
  if (!id) throw new Error('No Pathao store available — create/select a store in Pathao merchant panel');
  return id;
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
  const client = await getAuthClient(token);
  const { data } = await client.post('/aladdin/api/v1/stores', storeData);
  return data.data;
}

// ─── Geo endpoints ──────────────────────────────────────────────────────────

export async function getCities(): Promise<any[]> {
  const token = await ensureToken();
  const client = await getAuthClient(token);
  const { data } = await client.get('/aladdin/api/v1/city-list');
  return unwrapList(data?.data ?? data);
}

export async function getZones(cityId: number): Promise<any[]> {
  const token = await ensureToken();
  const client = await getAuthClient(token);
  const { data } = await client.get(`/aladdin/api/v1/cities/${cityId}/zone-list`);
  return unwrapList(data?.data ?? data);
}

export async function getAreas(zoneId: number): Promise<any[]> {
  const token = await ensureToken();
  const client = await getAuthClient(token);
  const { data } = await client.get(`/aladdin/api/v1/zones/${zoneId}/area-list`);
  return unwrapList(data?.data ?? data);
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
    const client = await getAuthClient(token);
    let storeId = Number(input.store_id) || 0;
    if (!storeId) storeId = await getDefaultStoreId();

    const recipient_phone = assertPathaoPhone(input.recipient_phone);
    const item_weight = clampPathaoWeight(input.item_weight);
    const recipient_name = String(input.recipient_name || '').trim().slice(0, 100);
    const recipient_address = String(input.recipient_address || '').trim().slice(0, 220);
    if (recipient_name.length < 3) {
      return { success: false, message: 'Pathao recipient name must be at least 3 characters' };
    }
    if (recipient_address.length < 10) {
      return { success: false, message: 'Pathao recipient address must be at least 10 characters' };
    }

    const payload = {
      ...input,
      store_id: storeId,
      recipient_phone,
      recipient_name,
      recipient_address,
      item_weight,
    };
    // #region agent log
    const _dbgAttempt = { sessionId: '7c9155', runId: 'pathao-book', hypothesisId: 'D', location: 'pathaoService.ts:createOrder', message: 'pathao createOrder attempt', data: { storeId, city: payload.recipient_city, zone: payload.recipient_zone, area: payload.recipient_area || null, merchantOrderId: payload.merchant_order_id, cod: payload.amount_to_collect, phoneLen: recipient_phone.length, phonePrefix: recipient_phone.slice(0, 2), weight: item_weight }, timestamp: Date.now() };
    console.log('DBG7c9155', JSON.stringify(_dbgAttempt));
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c9155' }, body: JSON.stringify(_dbgAttempt) }).catch(() => {});
    // #endregion

    const { data } = await client.post('/aladdin/api/v1/orders', payload);

    // #region agent log
    const _dbgOk = { sessionId: '7c9155', runId: 'pathao-book', hypothesisId: 'D', location: 'pathaoService.ts:createOrder-ok', message: 'pathao createOrder success', data: { consignmentId: data.data?.consignment_id || null, orderStatus: data.data?.order_status || null }, timestamp: Date.now() };
    console.log('DBG7c9155', JSON.stringify(_dbgOk));
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c9155' }, body: JSON.stringify(_dbgOk) }).catch(() => {});
    // #endregion

    return {
      success: true,
      consignment_id: data.data?.consignment_id,
      merchant_order_id: data.data?.merchant_order_id,
      order_status: data.data?.order_status,
      delivery_fee: data.data?.delivery_fee,
      raw: data.data,
    };
  } catch (err: any) {
    const apiMsg = formatPathaoApiError(err.response?.data, err.message || 'Pathao order failed');
    console.error('[pathao] createOrder error:', err.response?.data || err.message);
    // #region agent log
    const _dbgErr = { sessionId: '7c9155', runId: 'pathao-book', hypothesisId: 'D', location: 'pathaoService.ts:createOrder-error', message: 'pathao createOrder failed', data: { err: String(apiMsg).slice(0, 400) }, timestamp: Date.now() };
    console.log('DBG7c9155', JSON.stringify(_dbgErr));
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c9155' }, body: JSON.stringify(_dbgErr) }).catch(() => {});
    // #endregion
    return {
      success: false,
      message: apiMsg,
    };
  }
}

export async function getOrderInfo(consignmentId: string): Promise<any> {
  const token = await ensureToken();
  const client = await getAuthClient(token);
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
  const client = await getAuthClient(token);
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
