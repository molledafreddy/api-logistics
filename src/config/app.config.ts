import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.APP_PORT || '3000', 10),
  url: process.env.APP_URL || 'http://localhost:3000',
  name: process.env.APP_NAME || 'API-Logistics',
  version: process.env.APP_VERSION || '1.0.0',
  apiPrefix: process.env.API_PREFIX || 'v1',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim()),
}));
