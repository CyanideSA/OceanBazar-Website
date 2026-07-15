'use client';

/**
 * PushNotificationInit
 *
 * Silently initialises Web Push after the user logs in.
 * - Registers the service worker (/sw.js)
 * - Requests Notification permission
 * - Subscribes the browser and POSTs the subscription to /api/push/subscribe
 *
 * Mounted inside <Providers> so it runs on every authenticated page load.
 * All failures are non-fatal — push is best-effort.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { initPushNotifications } from '@/lib/pushNotifications';

export default function PushNotificationInit() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const initialised = useRef(false);

  useEffect(() => {
    // Only run once per authenticated session
    if (!isAuthenticated || !userId || initialised.current) return;

    // Skip if VAPID key is not configured (avoids console noise in dev)
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    // Skip if browser doesn't support Push API
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) return;

    initialised.current = true;

    // Delay 3 s so push permission prompt doesn't fire immediately on load
    const timer = setTimeout(() => {
      initPushNotifications().catch(() => {
        // Non-fatal: push simply stays disabled
        initialised.current = false;
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, userId]);

  // Reset so next login re-initialises
  useEffect(() => {
    if (!isAuthenticated) {
      initialised.current = false;
    }
  }, [isAuthenticated]);

  return null;
}
