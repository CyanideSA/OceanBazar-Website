/**
 * Web Push Notification Service
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY  (generate via: npx web-push generate-vapid-keys)
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT     (e.g. mailto:admin@oceanbazar.com)
 *
 * Install: npm install web-push @types/web-push
 */
import { prisma } from '../lib/prisma';

import webpush from 'web-push';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     || 'mailto:admin@oceanbazar.com';

let vapidConfigured = false;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
} else {
  console.warn('[push] VAPID keys not set — push notifications disabled');
}

export function isVapidConfigured(): boolean {
  return vapidConfigured;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send a push notification to a single user (all their active subscriptions). */
export async function sendToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured) return;

  const subs = await prisma.push_subscriptions.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const payloadStr = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
          { TTL: 86400 }
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.id);
        } else {
          console.error('[push] send error:', err.message);
        }
      }
    })
  );

  if (stale.length > 0) {
    await prisma.push_subscriptions.deleteMany({ where: { id: { in: stale } } });
  }
}

/** Broadcast to all subscribed users (use sparingly — admin only). */
export async function broadcast(payload: PushPayload, limit = 500): Promise<{ sent: number; failed: number }> {
  if (!vapidConfigured) return { sent: 0, failed: 0 };

  const subs = await prisma.push_subscriptions.findMany({ take: limit });
  const payloadStr = JSON.stringify(payload);
  let sent = 0, failed = 0;
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
          { TTL: 86400 }
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.id);
        failed++;
      }
    })
  );

  if (stale.length > 0) {
    await prisma.push_subscriptions.deleteMany({ where: { id: { in: stale } } });
  }

  return { sent, failed };
}
