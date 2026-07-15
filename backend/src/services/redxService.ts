import axios, { AxiosInstance } from 'axios';

// ─── Configuration ───────────────────────────────────────────────────────────

const SANDBOX_BASE = 'https://sandbox.redx.com.bd/v1.0.0-beta';
const PRODUCTION_BASE = 'https://openapi.redx.com.bd/v1.0.0-beta';

function getConfig() {
  const isSandbox = (process.env.REDX_ENV || 'sandbox') === 'sandbox';
  return {
    baseUrl: process.env.REDX_BASE_URL || (isSandbox ? SANDBOX_BASE : PRODUCTION_BASE),
    token: process.env.REDX_API_TOKEN || '',
  };
}

function getClient(): AxiosInstance {
  const cfg = getConfig();
  return axios.create({
    baseURL: cfg.baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'API-ACCESS-TOKEN': `Bearer ${cfg.token}`,
    },
  });
}

// ─── Track Parcel ─────────────────────────────────────────────────────────────
// GET /parcel/track/<tracking_id>

export async function trackParcel(trackingId: string): Promise<{
  success: boolean;
  tracking?: any[];
  message?: string;
}> {
  try {
    const client = getClient();
    const { data } = await client.get(`/parcel/track/${trackingId}`);
    return { success: true, tracking: data.tracking || data };
  } catch (err: any) {
    console.error('[redx] trackParcel error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

// ─── Get Parcel Details ───────────────────────────────────────────────────────
// GET /parcel/info/<tracking_id>

export async function getParcelDetails(trackingId: string): Promise<any> {
  try {
    const client = getClient();
    const { data } = await client.get(`/parcel/info/${trackingId}`);
    return data.parcel ?? data;
  } catch (err: any) {
    console.error('[redx] getParcelDetails error:', err.response?.data || err.message);
    return null;
  }
}

// ─── Create Parcel ────────────────────────────────────────────────────────────
// POST /parcel

export interface RedxParcelInput {
  customer_name: string;
  customer_phone: string;
  delivery_area: string;       // Name of delivery area
  delivery_area_id: number;    // Unique ID of delivery area
  customer_address: string;
  merchant_invoice_id?: string;
  cash_collection_amount: number; // string accepted by API but we send as number
  parcel_weight: number;       // in grams
  instruction?: string;
  type?: string;               // used for reverse shipments
  value: number;               // declared value for compensation
  is_closed_box?: number;
  pickup_store_id?: number;
  parcel_details_json?: Array<{
    name: string;
    category: string;
    value: number;
  }>;
}

export interface RedxParcelResult {
  success: boolean;
  tracking_id?: string;
  message?: string;
  raw?: any;
}

export async function createParcel(input: RedxParcelInput): Promise<RedxParcelResult> {
  try {
    const client = getClient();
    // API accepts cash_collection_amount as string
    const payload = {
      ...input,
      cash_collection_amount: String(input.cash_collection_amount),
      parcel_weight: String(input.parcel_weight),
      value: String(input.value),
    };
    const { data } = await client.post('/parcel', payload);
    return {
      success: true,
      tracking_id: String(data.tracking_id ?? ''),
      message: data.message,
      raw: data,
    };
  } catch (err: any) {
    console.error('[redx] createParcel error:', err.response?.data || err.message);
    return {
      success: false,
      message: err.response?.data?.message || err.message,
    };
  }
}

// ─── Update Parcel ────────────────────────────────────────────────────────────
// PATCH /parcels
// Body: { entity_type, entity_id, update_details: { property_name, new_value, reason? } }

export async function updateParcel(
  trackingId: string,
  propertyName: string,
  newValue: string,
  reason?: string,
): Promise<{ success: boolean; message?: string; raw?: any }> {
  try {
    const client = getClient();
    const { data } = await client.patch('/parcels', {
      entity_type: 'parcel-tracking-id',
      entity_id: trackingId,
      update_details: {
        property_name: propertyName,
        new_value: newValue,
        ...(reason ? { reason } : {}),
      },
    });
    return { success: data.success === true, message: data.message, raw: data };
  } catch (err: any) {
    console.error('[redx] updateParcel error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

/** Cancel a RedX parcel — sets status to 'cancelled' */
export async function cancelParcel(
  trackingId: string,
  reason = 'Order cancelled by merchant',
): Promise<{ success: boolean; message?: string }> {
  return updateParcel(trackingId, 'status', 'cancelled', reason);
}

// ─── Areas ────────────────────────────────────────────────────────────────────
// GET /areas
// GET /areas?post_code=<postal_code>
// GET /areas?district_name=<district_name>

export async function getAreas(filters?: {
  postCode?: number | string;
  districtName?: string;
}): Promise<any[]> {
  try {
    const client = getClient();
    const params: Record<string, string | number> = {};
    if (filters?.postCode) params.post_code = filters.postCode;
    if (filters?.districtName) params.district_name = filters.districtName;
    const { data } = await client.get('/areas', { params });
    return data.areas || [];
  } catch (err: any) {
    console.error('[redx] getAreas error:', err.response?.data || err.message);
    return [];
  }
}

// ─── Pickup Stores ────────────────────────────────────────────────────────────
// POST /pickup/store
// GET  /pickup/stores
// GET  /pickup/store/info/<pickup_store_id>

export async function createPickupStore(storeData: {
  name: string;
  phone: string;
  address: string;
  area_id: number;
}): Promise<{ success: boolean; store?: any; message?: string }> {
  try {
    const client = getClient();
    const { data } = await client.post('/pickup/store', storeData);
    // Response: { id, name, address, area_name, area_id, phone }
    return { success: true, store: data };
  } catch (err: any) {
    console.error('[redx] createPickupStore error:', err.response?.data || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

export async function getPickupStores(): Promise<any[]> {
  try {
    const client = getClient();
    const { data } = await client.get('/pickup/stores');
    // API returns: { pickup_stores: [...] }
    return data.pickup_stores || [];
  } catch (err: any) {
    console.error('[redx] getPickupStores error:', err.response?.data || err.message);
    return [];
  }
}

export async function getPickupStoreDetails(storeId: number): Promise<any | null> {
  try {
    const client = getClient();
    const { data } = await client.get(`/pickup/store/info/${storeId}`);
    // API returns: { pickup_store: { id, name, address, area_name, area_id, phone, created_at } }
    return data.pickup_store ?? null;
  } catch (err: any) {
    console.error('[redx] getPickupStoreDetails error:', err.response?.data || err.message);
    return null;
  }
}

// ─── Calculate Parcel Charge ──────────────────────────────────────────────────
// GET /charge/charge_calculator?delivery_area_id=&pickup_area_id=&cash_collection_amount=&weight=

export async function calculateParcelCharge(params: {
  delivery_area_id: number;
  pickup_area_id: number;
  cash_collection_amount: number;
  weight: number; // grams
}): Promise<{ deliveryCharge: number; codCharge: number } | null> {
  try {
    const client = getClient();
    const { data } = await client.get('/charge/charge_calculator', { params });
    return {
      deliveryCharge: data.deliveryCharge ?? 0,
      codCharge: data.codCharge ?? 0,
    };
  } catch (err: any) {
    console.error('[redx] calculateParcelCharge error:', err.response?.data || err.message);
    return null;
  }
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

/** Maps RedX parcel statuses to internal OceanBazar statuses */
export function mapRedxStatus(status: string): string {
  const normalized = String(status).toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, string> = {
    pending:                'pending',
    pickup_pending:         'pending',
    pickup_assigned:        'pending',
    pickup_failed:          'pending',
    picked_up:              'picked_up',
    in_warehouse:           'in_transit',
    in_transit:             'in_transit',
    at_delivery_hub:        'in_transit',
    rider_assigned:         'out_for_delivery',
    out_for_delivery:       'out_for_delivery',
    delivered:              'delivered',
    return:                 'returned',
    returned:               'returned',
    return_in_transit:      'returned',
    returned_to_merchant:   'returned',
    cancelled:              'cancelled',
    on_hold:                'on_hold',
    delivery_failed:        'on_hold',
    partial_delivery:       'partial_delivery',
  };
  return map[normalized] || 'in_transit';
}
