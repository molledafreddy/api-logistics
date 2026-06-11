import { registerAs } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const databaseConfig = registerAs('database', () => {
  const databaseUrl = process.env.DATABASE_URL;

  const connectionOptions = databaseUrl
    ? {
        url: databaseUrl,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'logistics_dev',
        username: process.env.DB_USER || 'logistics',
        password: process.env.DB_PASSWORD || 'logistics_dev_pass',
        ssl:
          process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };

  return {
    type: 'postgres' as const,
    ...connectionOptions,
    logging: process.env.DB_LOGGING === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    namingStrategy: new SnakeNamingStrategy(),
    autoLoadEntities: true,
    extra: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
  };
});
