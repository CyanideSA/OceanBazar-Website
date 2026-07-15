import axios, { AxiosInstance } from 'axios';
import { getRedisClient, isRedisConnected } from '../cache/redisClient';

/**
 * Client for the Python FastAPI ML service.
 *
 * - Timeouts + bounded retries on transient failures.
 * - Simple circuit breaker: after N consecutive failures the breaker opens for a
 *   cooldown window and calls fail fast (so the admin UI degrades gracefully
 *   instead of hanging).
 * - Optional Redis response caching for read-heavy endpoints.
 *
 * Configure with ML_SERVICE_URL, ML_SERVICE_API_KEY, ML_SERVICE_TIMEOUT_MS.
 */

const BASE_URL = process.env.ML_SERVICE_URL || '';
const API_KEY = process.env.ML_SERVICE_API_KEY || '';
const TIMEOUT = Number(process.env.ML_SERVICE_TIMEOUT_MS || 20_000);

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

export function isMlConfigured(): boolean {
  return Boolean(BASE_URL);
}

export class MlUnavailableError extends Error {
  constructor(message = 'ML service unavailable') {
    super(message);
    this.name = 'MlUnavailableError';
  }
}

function http(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT,
    headers: API_KEY ? { 'X-ML-API-Key': API_KEY } : {},
  });
}

function breakerOpen(): boolean {
  return Date.now() < breakerOpenUntil;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    breakerOpenUntil = Date.now() + COOLDOWN_MS;
    consecutiveFailures = 0;
    console.warn(`[ml] circuit breaker opened for ${COOLDOWN_MS}ms`);
  }
}

async function request<T>(method: 'get' | 'post', path: string, body?: unknown, retries = 2): Promise<T> {
  if (!isMlConfigured()) throw new MlUnavailableError('ML_SERVICE_URL not set');
  if (breakerOpen()) throw new MlUnavailableError('ML circuit breaker open');

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = http();
      const res = method === 'get'
        ? await client.get(path, { params: body as Record<string, unknown> })
        : await client.post(path, body);
      recordSuccess();
      return res.data as T;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      // Do not retry 4xx (client errors); retry network/5xx.
      if (status && status >= 400 && status < 500) break;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  recordFailure();
  const detail = (lastErr as any)?.response?.data?.detail || (lastErr as Error)?.message;
  throw new MlUnavailableError(`ML request ${path} failed: ${detail}`);
}

// ─── Cache helpers ──────────────────────────────────────────────────────────

async function cached<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
  if (isRedisConnected()) {
    try {
      const redis = await getRedisClient();
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit) as T;
      const value = await producer();
      await redis.setEx(key, ttlSeconds, JSON.stringify(value));
      return value;
    } catch {
      /* fall through to uncached */
    }
  }
  return producer();
}

// ─── Typed endpoints ─────────────────────────────────────────────────────────

export interface ChurnScore {
  customer_id: string;
  churn_score: number;
  predicted_ltv: number;
  segment: string;
  recency_days: number | null;
  frequency: number;
  monetary: number;
}

export interface DemandScore {
  product_id: string;
  title: string | null;
  demand_score: number;
  units_sold: number;
  stock: number;
  days_of_cover: number | null;
  restock_suggested: boolean;
}

export interface ForecastResponse {
  method: string;
  horizon_days: number;
  history_points: number;
  total_predicted: number;
  points: { date: string; predicted_revenue: number; lower: number; upper: number }[];
}

export interface SeoGeneration {
  source: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  schema_json: Record<string, unknown>;
  faq: { question: string; answer: string }[];
  seo_score: number;
}

export interface MarketingGeneration {
  source: string;
  subject: string | null;
  body: string;
}

export function predictChurn(payload: { customer_ids?: string[]; persist?: boolean }) {
  return request<{ model_version: string; count: number; results: ChurnScore[] }>('post', '/predict/churn', payload);
}

export function predictDemand(payload: { product_ids?: string[]; window_days?: number; persist?: boolean }) {
  return request<{ model_version: string; count: number; results: DemandScore[] }>('post', '/predict/demand', payload);
}

export function forecastSales(payload: { horizon_days?: number; history_days?: number }) {
  const key = `ml:forecast:${payload.horizon_days || 30}:${payload.history_days || 180}`;
  return cached(key, 3600, () => request<ForecastResponse>('post', '/forecast/sales', payload));
}

export function generateSeo(payload: {
  entity_type: string; name: string; description?: string; category?: string;
  keywords?: string[]; language?: string; canonical_url?: string;
}) {
  return request<SeoGeneration>('post', '/generate/seo', payload);
}

export function generateMarketing(payload: {
  kind: string; topic: string; audience?: string; tone?: string;
  language?: string; product_name?: string; extra_context?: string;
}) {
  return request<MarketingGeneration>('post', '/generate/marketing', payload);
}

export function recompute(payload: { churn?: boolean; demand?: boolean; window_days?: number }) {
  return request<{ status: string; churn: number; demand: number }>('post', '/batch/recompute', payload);
}

export function mlHealth() {
  return request<{ status: string; db: boolean; openai: boolean; model_version: string }>('get', '/health');
}
