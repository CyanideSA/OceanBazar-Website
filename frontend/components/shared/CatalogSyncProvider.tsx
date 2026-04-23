'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'http://127.0.0.1:8000';
const MAX_FAILURES = 5;

/**
 * Subscribes to /topic/catalog/changes over STOMP/SockJS and
 * invalidates React Query caches when the admin updates a product or category.
 * No authentication required — the backend permits unauthenticated WS for catalog hints.
 */
export default function CatalogSyncProvider() {
  const queryClient = useQueryClient();
  const failRef = useRef(0);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const wsUrl = `${WS_BASE.replace(/\/$/, '')}/ws`;

    const client = new Client({
      debug: () => {},
      webSocketFactory: () => new (SockJS as any)(wsUrl),
      reconnectDelay: 10_000,
      heartbeatIncoming: 20_000,
      heartbeatOutgoing: 20_000,
      connectionTimeout: 15_000,
    });

    client.onConnect = () => {
      failRef.current = 0;
      client.subscribe('/topic/catalog/changes', (msg) => {
        try {
          const payload = JSON.parse(msg.body) as { productId?: string; change?: string };
          const { productId, change } = payload;
          if (change === 'deleted') {
            queryClient.removeQueries({ queryKey: ['product', productId] });
          } else {
            queryClient.invalidateQueries({ queryKey: ['product', productId] });
          }
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['featured'] });
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        } catch {
          /* ignore malformed frames */
        }
      });
    };

    const bumpFail = () => {
      failRef.current += 1;
      if (failRef.current >= MAX_FAILURES) {
        client.reconnectDelay = 0;
        try { client.deactivate(); } catch { /* ignore */ }
      }
    };

    client.onStompError = bumpFail;
    client.onWebSocketClose = bumpFail;
    client.onWebSocketError = bumpFail;

    client.activate();
    clientRef.current = client;

    return () => {
      try { client.deactivate(); } catch { /* ignore */ }
    };
  }, [queryClient]);

  return null;
}
