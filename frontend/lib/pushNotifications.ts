'use client';

import { trackPwaEvent } from '@/lib/pwaAnalytics';

/**
 * OceanBazar Web Push Notifications
 * Uses the Web Push API + service worker (sw.js).
 *
 * Required env var:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — from your push server
 *
 * To generate VAPID keys:
 *   npx web-push generate-vapid-keys
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const bytes = urlBase64ToUint8Array(base64String);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
    return null;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push disabled');
    return null;
  }
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
    });
  } catch (err) {
    console.warn('[Push] Subscribe failed:', err);
    return null;
  }
}

/** Send the subscription object to the backend so we can send push messages. */
export async function saveSubscriptionToBackend(sub: PushSubscription): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return;
  const raw = sub.toJSON();
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ob_token') ?? sessionStorage.getItem('ob_token') : null;
    await fetch(`${apiBase}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
    });
  } catch (err) {
    console.warn('[Push] Failed to save subscription to backend:', err);
  }
}

export async function initPushNotifications(onSubscription?: (sub: PushSubscription) => void): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg) return;
  const granted = await requestPushPermission();
  if (!granted) return;
  const sub = await subscribeToPush(reg);
  if (sub) {
    await saveSubscriptionToBackend(sub);
    trackPwaEvent('pwa_push_subscribed', { endpointHost: (() => {
      try { return new URL(sub.endpoint).host; } catch { return 'unknown'; }
    })() });
    if (onSubscription) onSubscription(sub);
  }
}
