import { createClient, type RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6399';

let client: RedisClientType;
let connected = false;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= 3) {
            console.warn('[redis] Giving up after 3 retries — caching disabled.');
            return false;
          }
          return Math.min(retries * 1000, 3000);
        },
      },
    });
    client.on('error', (err) => {
      if (!connected) console.warn('[redis] Connection error:', err.message);
      connected = false;
    });
    client.on('connect', () => {
      connected = true;
      console.log('[redis] Connected to', REDIS_URL);
    });
  }
  if (!connected) {
    try {
      await client.connect();
      connected = true;
    } catch {
      // already connecting or failed
    }
  }
  return client;
}

export function isRedisConnected(): boolean {
  return connected;
}
