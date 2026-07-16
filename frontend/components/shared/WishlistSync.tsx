'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { wishlistApi } from '@/lib/api';

/**
 * WishlistSync — mounts globally and syncs the local wishlist store with the backend.
 * On login: pushes local wishlist IDs to server, then merges server state back.
 * Fires once per auth session. Non-blocking and non-fatal.
 */
export default function WishlistSync() {
  const { isAuthenticated, user } = useAuthStore();
  const { ids, mergeIds } = useWishlistStore();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('ob_access_token')) return;
    if (syncedRef.current === user.id) return;
    syncedRef.current = user.id;

    (async () => {
      try {
        const { data } = await wishlistApi.sync(ids);
        if (Array.isArray(data?.ids)) {
          mergeIds(data.ids);
        }
      } catch {
        try {
          const { data } = await wishlistApi.get();
          if (Array.isArray(data?.ids)) mergeIds(data.ids);
        } catch { /* non-fatal — stay local */ }
      }
    })();
  }, [isAuthenticated, user?.id, ids, mergeIds]);

  useEffect(() => {
    if (!isAuthenticated) syncedRef.current = null;
  }, [isAuthenticated]);

  return null;
}
