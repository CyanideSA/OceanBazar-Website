'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { notificationsApi } from '@/lib/api';
import { getSocket, connectSocket } from '@/lib/socket';

/**
 * Connects to the server notifications API and Socket.io for live updates.
 * Merges server notifications into the local Zustand store.
 */
export function useNotifications() {
  const { user, isAuthenticated } = useAuthStore();
  const { items, add, hasServerId, markRead, markAllRead } = useNotificationsStore();
  const fetchedRef = useRef(false);

  const fetchFromServer = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await notificationsApi.list(user.id);
      const serverItems: Array<{ id: string; title?: string; body?: string; message?: string }> = data?.notifications || [];
      for (const sn of serverItems) {
        if (!hasServerId(sn.id)) {
          add({ serverId: sn.id, title: sn.title || 'Notification', body: sn.body || sn.message || '' });
        }
      }
    } catch {
      /* non-fatal */
    }
  }, [user?.id, hasServerId, add]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Fetch once on mount
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchFromServer();
    }

    // Listen for real-time notifications via Socket.io
    const socket = connectSocket();

    socket.emit('join:user', user.id);

    const handleNotification = (payload: { title?: string; body?: string; message?: string }) => {
      add({
        title: payload.title || 'New notification',
        body: payload.body || payload.message || '',
      });
    };

    socket.on('notification:new', handleNotification);
    socket.on('notification', handleNotification);
    socket.on('order_update', handleNotification);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('notification', handleNotification);
      socket.off('order_update', handleNotification);
      socket.emit('leave:user', user.id);
    };
  }, [isAuthenticated, user?.id, add, fetchFromServer]);

  const unreadCount = items.filter((n) => !n.read).length;

  return { items, unreadCount, markRead, markAllRead };
}
