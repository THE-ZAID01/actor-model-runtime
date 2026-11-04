import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 4000,
    reconnectStrategy: (retries) => Math.min(retries * 500, 3000),
  },
});
let lastRedisErrorAt = 0;
redis.on('error', (error) => {
  if (Date.now() - lastRedisErrorAt > 10000) {
    console.error('Redis unavailable:', error.message);
    lastRedisErrorAt = Date.now();
  }
});
redis.on('ready', () => console.log('Redis connection ready'));
export async function connectRedis() {
  if (!redis.isOpen) {
    await Promise.race([
      redis.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timed out')), 5000),
      ),
    ]);
  }
  console.log('Connected to Redis');
}
