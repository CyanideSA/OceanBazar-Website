import { useMemo } from 'react';
import { normalizeCartSummary } from '@/lib/cart';
import { useCartStore } from '@/stores/cartStore';
import type { CartSummary } from '@/types';

/** Always returns a normalized cart safe for UI (prices, titles, totals). */
export function useNormalizedCart(): CartSummary | null {
  const cart = useCartStore((s) => s.cart);
  return useMemo(() => (cart ? normalizeCartSummary(cart) : null), [cart]);
}
