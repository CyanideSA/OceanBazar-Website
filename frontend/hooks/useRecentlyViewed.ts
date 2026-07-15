'use client';

import { useEffect } from 'react';

const KEY = 'ob_recently_viewed';
const MAX = 8;

export function addRecentlyViewed(productId: string, title: string, image: string | null, price: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    const existing: Array<{ id: string; title: string; image: string | null; price: number | null; ts: number }> =
      JSON.parse(localStorage.getItem(KEY) || '[]');
    const filtered = existing.filter((p) => p.id !== productId);
    filtered.unshift({ id: productId, title, image, price, ts: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch { /* ignore */ }
}

export function getRecentlyViewed(): Array<{ id: string; title: string; image: string | null; price: number | null; ts: number }> {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function useTrackRecentlyViewed(
  productId: string,
  title: string | undefined,
  image: string | null | undefined,
  price: number | null | undefined
) {
  useEffect(() => {
    if (!productId || !title) return;
    addRecentlyViewed(productId, title, image ?? null, price ?? null);
  }, [productId, title, image, price]);
}
