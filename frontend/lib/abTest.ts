'use client';

import { useEffect, useState } from 'react';

const COOKIE_PREFIX = 'ob_ab_';
const SEEN_PREFIX = 'ob_ab_seen_';

export const AB_TESTS = {
  CHECKOUT_CTA: 'checkout-cta-v1',
  PAYMENT_ORDER: 'payment-order-v1',
  PRODUCT_PRICE_DISPLAY: 'price-display-v1',
  OB_POINTS: 'ob-points-v1',
  HERO_BANNER: 'hero-banner-v1',
  SHIPPING_BADGE: 'shipping-badge-v1',
  FLASH_URGENCY: 'flash-urgency-v1',
  COUPON_DISCOVERY: 'coupon-discovery-v1',
  PDP_AUDIENCE: 'pdp-audience-v1',
  CHECKOUT_LOGIN: 'checkout-login-v1',
  FLASH_SCARCITY: 'flash-scarcity-v1',
} as const;

export type AbTestId = (typeof AB_TESTS)[keyof typeof AB_TESTS];
export type AbVariant = 'A' | 'B';

type ExperimentConfig = {
  id: string;
  name: string;
  tier: number;
  surface: string;
  primary_metric: string;
  traffic_allocation: number;
  variant_a?: Record<string, unknown>;
  variant_b?: Record<string, unknown>;
};

type EventOptions = {
  value?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

let configCache: ExperimentConfig[] | null = null;
let configPromise: Promise<ExperimentConfig[]> | null = null;

function apiBase(): string {
  return String(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'ob_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, id);
  }
  return id;
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

async function loadConfig(): Promise<ExperimentConfig[]> {
  if (configCache) return configCache;
  if (configPromise) return configPromise;
  if (!apiBase()) return [];
  configPromise = fetch(`${apiBase()}/api/ab/config`, { credentials: 'omit' })
    .then((response) => response.ok ? response.json() : { experiments: [] })
    .then((data) => {
      configCache = Array.isArray(data?.experiments) ? data.experiments : [];
      return configCache as ExperimentConfig[];
    })
    .catch(() => [])
    .finally(() => { configPromise = null; });
  return configPromise;
}

export function getVariant(testId: string): AbVariant {
  if (typeof window === 'undefined') return 'A';
  const cookieName = COOKIE_PREFIX + testId;
  const stored = getCookie(cookieName);
  if (stored === 'A' || stored === 'B') return stored;
  const variant: AbVariant = simpleHash(testId + getOrCreateSessionId()) % 2 === 0 ? 'A' : 'B';
  setCookie(cookieName, variant);
  return variant;
}

function isEnrolled(test: ExperimentConfig): boolean {
  const allocation = Math.min(100, Math.max(1, Number(test.traffic_allocation || 100)));
  return simpleHash(`${test.id}:allocation:${getOrCreateSessionId()}`) % 100 < allocation;
}

async function sendEvent(
  test: ExperimentConfig,
  eventType: string,
  options: EventOptions = {},
): Promise<void> {
  if (!apiBase() || !isEnrolled(test)) return;
  const variant = getVariant(test.id);
  try {
    await fetch(`${apiBase()}/api/ab/${eventType === 'impression' ? 'impression' : 'event'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': getOrCreateSessionId() },
      body: JSON.stringify({
        testId: test.id,
        variant,
        sessionId: getOrCreateSessionId(),
        eventType,
        value: options.value,
        idempotencyKey: options.idempotencyKey,
        metadata: options.metadata,
      }),
      keepalive: true,
    });
  } catch {
    // Experiment telemetry must never block shopping.
  }
}

export async function trackAbImpression(testId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const test = (await loadConfig()).find((item) => item.id === testId);
  if (!test || !isEnrolled(test)) return;
  const dedupKey = `ob_ab_imp_${testId}`;
  if (sessionStorage.getItem(dedupKey)) return;
  sessionStorage.setItem(dedupKey, '1');
  sessionStorage.setItem(SEEN_PREFIX + testId, '1');
  await sendEvent(test, 'impression', {
    idempotencyKey: `impression:${getOrCreateSessionId()}`,
    metadata: {
      locale: document.documentElement.lang || undefined,
      viewport: window.innerWidth < 768 ? 'mobile' : 'desktop',
    },
  });
}

export function useAbVariant(testId: string): AbVariant {
  const [variant, setVariant] = useState<AbVariant>('A');
  useEffect(() => {
    let cancelled = false;
    loadConfig().then((tests) => {
      const test = tests.find((item) => item.id === testId);
      if (!cancelled && test && isEnrolled(test)) {
        setVariant(getVariant(testId));
        void trackAbImpression(testId);
      }
    });
    return () => { cancelled = true; };
  }, [testId]);
  return variant;
}

export async function trackAbEvent(
  testId: string,
  eventType: string,
  options: EventOptions = {},
): Promise<void> {
  const test = (await loadConfig()).find((item) => item.id === testId);
  if (!test || (typeof window !== 'undefined' && !sessionStorage.getItem(SEEN_PREFIX + testId))) return;
  await sendEvent(test, eventType, options);
}

/** Track the primary outcome for every active experiment the shopper actually saw. */
export async function trackAbOutcome(eventType: string, options: EventOptions = {}): Promise<void> {
  if (typeof window === 'undefined') return;
  const tests = await loadConfig();
  await Promise.all(tests
    .filter((test) => test.primary_metric === eventType && sessionStorage.getItem(SEEN_PREFIX + test.id))
    .map((test) => sendEvent(test, eventType, {
      ...options,
      idempotencyKey: `${eventType}:${options.idempotencyKey || getOrCreateSessionId()}`,
    })));
}

export async function trackAbConversion(testId: string, options: EventOptions = {}): Promise<void> {
  await trackAbEvent(testId, 'conversion', options);
}

export function clearAbConfigCache(): void {
  configCache = null;
}
