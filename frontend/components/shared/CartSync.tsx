'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { cartApi } from '@/lib/api';

/**
 * On login: push any guest-local cart lines to the server cart, then hydrate from server.
 * Mirrors WishlistSync — non-blocking and non-fatal.
 */
export default function CartSync() {
  const { isAuthenticated, user } = useAuthStore();
  const setCart = useCartStore((s) => s.setCart);
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('ob_access_token')) return;
    if (syncedRef.current === user.id) return;
    syncedRef.current = user.id;

    (async () => {
      const guestItems = useCartStore.getState().cart?.items ?? [];
      try {
        for (const item of guestItems) {
          try {
            await cartApi.add(item.productId, item.quantity, item.variantId ?? undefined);
          } catch {
            /* keep pushing remaining lines */
          }
        }
        const server = await cartApi.get();
        setCart(server);
      } catch {
        try {
          const server = await cartApi.get();
          setCart(server);
        } catch {
          /* stay on local cart until checkout */
        }
      }
    })();
  }, [isAuthenticated, user?.id, setCart]);

  useEffect(() => {
    if (!isAuthenticated) syncedRef.current = null;
  }, [isAuthenticated]);

  return null;
}
