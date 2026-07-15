'use client';

/**
 * OceanBazar A/B Testing Framework
 *
 * Cookie-based, deterministic per user-session.
 * Variant assignment: stable hash of (testId + sessionId) → 'A' | 'B'
 *
 * Usage:
 *   const variant = useAbVariant('checkout-cta-test'); // returns 'A' | 'B'
 *   // Impression is auto-tracked on mount (deduped per session)
 *
 * To track a conversion:
 *   trackAbConversion('checkout-cta-test');
 */

import { useEffect, useState } from 'react';

const COOKIE_PREFIX = 'ob_ab_';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'ob_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, id);
  }
  return id;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

export function getVariant(testId: string): 'A' | 'B' {
  if (typeof window === 'undefined') return 'A';
  const cookieName = COOKIE_PREFIX + testId;
  const stored = getCookie(cookieName);
  if (stored === 'A' || stored === 'B') return stored;

  const sessionId = getOrCreateSessionId();
  const variant: 'A' | 'B' = simpleHash(testId + sessionId) % 2 === 0 ? 'A' : 'B';
  setCookie(cookieName, variant);
  return variant;
}

/** Track an impression (view) — fires once per test per session. */
export async function trackAbImpression(testId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const dedupKey = `ob_ab_imp_${testId}`;
  if (sessionStorage.getItem(dedupKey)) return;
  sessionStorage.setItem(dedupKey, '1');

  const variant = getVariant(testId);
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return;
  try {
    await fetch(`${apiBase}/api/ab/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, variant, sessionId: getOrCreateSessionId() }),
      keepalive: true,
    });
  } catch { /* non-fatal */ }
}

export function useAbVariant(testId: string): 'A' | 'B' {
  const [variant, setVariant] = useState<'A' | 'B'>('A');
  useEffect(() => {
    const v = getVariant(testId);
    setVariant(v);
    // Auto-track impression on first render (deduped per session via sessionStorage)
    trackAbImpression(testId);
  }, [testId]);
  return variant;
}

/** Track a conversion event — sends to backend. */
export async function trackAbConversion(testId: string): Promise<void> {
  const variant = getVariant(testId);
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return;
  try {
    await fetch(`${apiBase}/api/ab/conversion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, variant }),
      keepalive: true,
    });
  } catch { /* non-fatal */ }
}

/** All active A/B tests — edit this list to create new tests. */
export const AB_TESTS = {
  CHECKOUT_CTA: 'checkout-cta-v1',           // A: "Place Order", B: "Complete Purchase"
  PRODUCT_PRICE_DISPLAY: 'price-display-v1', // A: ৳1,200, B: ৳1,200.00
  HERO_BANNER: 'hero-banner-v1',             // A: image, B: video
  SHIPPING_BADGE: 'shipping-badge-v1',       // A: "Free Shipping", B: "Free Delivery Today"
} as const;
