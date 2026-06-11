export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  tls?: object;
  connectTimeout: number;
  maxRetriesPerRequest: number | null;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
}

export function getRedisConnection(): RedisConnectionOptions {
  const base = {
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: false,
  };

  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      ...base,
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    };
  }

  return {
    ...base,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  };
}
