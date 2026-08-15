import type { Server as SocketIOServer } from 'socket.io';
import { getRedisClient, isRedisConnected } from '../cache/redisClient';
import { emitToRoom, emitToUser, emitBroadcast } from '../lib/adminEvents';
import { appLog } from '../lib/appLog';

/** Sole realtime ingress from Java → BFF (STOMP removed). */
export const REALTIME_CHANNEL = 'ob:realtime';

export type RealtimeMessage = {
  target: 'broadcast' | 'room' | 'user';
  room?: string;
  userId?: string;
  event: string;
  payload: Record<string, unknown>;
};

const ADMIN_ROOM_MAP: Record<string, string> = {
  'admin:orders': 'admin:orders',
  'admin:inventory': 'admin:crm',
  'admin:reviews': 'admin:crm',
  'admin:payments': 'admin:crm',
  'admin:returns': 'admin:returns',
  'admin:chats': 'admin:chat',
  'admin:users': 'admin:crm',
  'admin:fulfillment': 'admin:crm',
  'admin:tickets': 'admin:chat',
  'admin:alerts': 'admin:crm',
  'catalog:changes': 'catalog:changes',
};

const EVENT_ALIASES: Record<string, string> = {
  'catalog:updated': 'catalog:updated',
  'admin:order:updated': 'admin:order:updated',
  'admin:order:new': 'admin:order:new',
  'admin:chat:new': 'admin:chat:new',
  'admin:return:new': 'admin:return:new',
  'admin:payment': 'admin:payment',
  'admin:ticket:updated': 'admin:ticket:updated',
  'ticket:updated': 'ticket:updated',
  'notification:new': 'notification:new',
};

function resolveEventName(event: string, room?: string): string {
  if (EVENT_ALIASES[event]) return EVENT_ALIASES[event];
  if (room === 'catalog:changes') return 'catalog:updated';
  return event;
}

function dispatch(msg: RealtimeMessage): void {
  const { target, room, userId, payload } = msg;
  const event = resolveEventName(msg.event, room);

  if (target === 'broadcast') {
    emitBroadcast(event, payload);
    return;
  }
  if (target === 'user' && userId) {
    emitToUser(userId, event, payload);
    return;
  }
  if (target === 'room' && room) {
    const socketRoom = ADMIN_ROOM_MAP[room] ?? room;
    emitToRoom(socketRoom, event, payload);
    if (room.startsWith('admin:')) {
      emitToRoom('admin:crm', event, payload);
    }
    if (room === 'catalog:changes') {
      emitBroadcast('catalog:updated', payload);
    }
  }
}

let subscribed = false;

export async function startRedisEventBridge(_io: SocketIOServer): Promise<void> {
  if (subscribed) return;
  if (process.env.FEATURE_REALTIME_ENABLED === 'false') {
    appLog('info', 'realtime_bridge_disabled', {});
    return;
  }
  if (process.env.WEBSOCKET_STOMP_ENABLED === 'true') {
    appLog('error', 'realtime_stomp_enabled_forbidden', {
      detail: 'Set WEBSOCKET_STOMP_ENABLED=false — only Redis bridge is supported',
    });
  }

  try {
    const redis = await getRedisClient();
    const sub = redis.duplicate();
    await sub.connect();

    await sub.subscribe(REALTIME_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message) as RealtimeMessage;
        if (!parsed?.event || !parsed?.target) return;
        dispatch(parsed);
      } catch (e) {
        appLog('warn', 'realtime_bridge_parse_error', {
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    });

    subscribed = true;
    appLog('info', 'realtime_bridge_started', {
      channel: REALTIME_CHANNEL,
      redisConnected: isRedisConnected(),
    });
  } catch (e) {
    appLog('error', 'realtime_bridge_unavailable', {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

export function isRealtimeBridgeActive(): boolean {
  return subscribed;
}
