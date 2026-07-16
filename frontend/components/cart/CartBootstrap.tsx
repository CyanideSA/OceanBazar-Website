'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/stores/cartStore';

/** One-time cleanup of legacy cart cache + re-normalize persisted cart on load. */
export default function CartBootstrap() {
  useEffect(() => {
    try {
      localStorage.removeItem('ob-cart-v1');
      const { cart, setCart } = useCartStore.getState();
      if (cart) setCart(cart);
    } catch {
      /* ignore private mode / quota */
    }
  }, []);

  return null;
}
