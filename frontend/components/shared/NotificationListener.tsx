'use client';

import { useNotifications } from '@/hooks/useNotifications';

/**
 * Invisible component that connects to Socket.io and syncs
 * server notifications for authenticated users. Mount once at app root.
 */
export default function NotificationListener() {
  useNotifications();
  return null;
}
