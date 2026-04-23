import { createClient, type RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6399';

let client: RedisClientType;
let connected = false;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on('error', (err) => {
      console.error('[redis] Connection error:', err.message);
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
