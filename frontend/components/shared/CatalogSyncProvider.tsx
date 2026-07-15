'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from '@/lib/socket';
import { getAccessToken } from '@/lib/auth';

/**
 * Catalog freshness via BFF Socket.IO (Java STOMP removed).
 * Event: catalog:updated { productId, change }
 */
export default function CatalogSyncProvider() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = connectSocket();
    socket.auth = { token };

    const onCatalog = (payload: { productId?: string; change?: string }) => {
      const { productId, change } = payload ?? {};
      if (change === 'deleted' && productId) {
        queryClient.removeQueries({ queryKey: ['product', productId] });
      } else if (productId) {
        queryClient.invalidateQueries({ queryKey: ['product', productId] });
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    };

    socket.on('catalog:updated', onCatalog);

    return () => {
      socket.off('catalog:updated', onCatalog);
      if (!getSocket().connected) return;
    };
  }, [queryClient]);

  return null;
}
