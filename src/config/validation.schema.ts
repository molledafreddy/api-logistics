import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // ─── App ──────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  APP_PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  APP_NAME: Joi.string().default('API-Logistics'),
  APP_VERSION: Joi.string().default('1.0.0'),
  API_PREFIX: Joi.string().default('v1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3001'),

  // ─── Database ─────────────────────────────
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_POOL_MIN: Joi.number().default(2),
  DB_POOL_MAX: Joi.number().default(10),

  // ─── Redis ────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_TLS: Joi.boolean().default(false),

  // ─── JWT (legacy, optional — Supabase handles auth) ─
  JWT_PRIVATE_KEY: Joi.string().allow('').default(''),
  JWT_PUBLIC_KEY: Joi.string().allow('').default(''),
  JWT_ACCESS_TOKEN_TTL: Joi.number().default(900),
  JWT_REFRESH_TOKEN_TTL: Joi.number().default(604800),

  // ─── Supabase ─────────────────────────────
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  SUPABASE_JWT_SECRET: Joi.string().required(),
  SUPABASE_JWT_AUD: Joi.string().default('authenticated'),

  // ─── S3 / MinIO ──────────────────────────
  S3_ENDPOINT: Joi.string().uri().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET_AVATARS: Joi.string().default('logistics-avatars'),
  S3_BUCKET_DOCUMENTS: Joi.string().default('logistics-documents'),
  S3_BUCKET_RECEIPTS: Joi.string().default('logistics-receipts'),
  S3_BUCKET_CHAT: Joi.string().default('logistics-chat'),
  S3_BUCKET_EXPORTS: Joi.string().default('logistics-exports'),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),

  // ─── Email ────────────────────────────────
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().default(1025),
  MAIL_USER: Joi.string().allow('').default(''),
  MAIL_PASSWORD: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().email().default('noreply@api-logistics.com'),
  MAIL_FROM_NAME: Joi.string().default('API Logistics'),

  // ─── Stripe ───────────────────────────────
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().required(),

  // ─── Firebase ─────────────────────────────
  FIREBASE_PROJECT_ID: Joi.string().allow('').default(''),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').default(''),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').default(''),

  // ─── Rate Limiting (3 buckets) ────────────
  THROTTLE_SHORT_TTL: Joi.number().default(1000),
  THROTTLE_SHORT_LIMIT: Joi.number().default(10),
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),
  THROTTLE_LONG_TTL: Joi.number().default(3600000),
  THROTTLE_LONG_LIMIT: Joi.number().default(1000),

  // ─── Performance / Body limits ────────────
  MAX_REQUEST_BODY_SIZE: Joi.string().default('1mb'),
  MAX_FILE_UPLOAD_SIZE: Joi.string().default('25mb'),

  // ─── Sentry (observabilidad) ──────────────
  SENTRY_DSN: Joi.string().allow('').default(''),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0),

  // ─── Logging ──────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('debug'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('pretty'),

  // ─── Seeds (CLI scripts) ──────────────────
  SUPER_ADMIN_EMAIL: Joi.string().email().default('admin@logistics-api.com'),
  SUPER_ADMIN_PASSWORD: Joi.string().min(8).default('SuperAdmin1!@#'),
  SEED_DEMO: Joi.boolean().default(false),

  // ─── Testing flags ────────────────────────
  // E2E_TEST=true bypasses real Supabase JWT verification (uses HS256 stub).
  E2E_TEST: Joi.boolean().default(false),

  // ─── Legacy / optional ────────────────────
  // Solo usado por src/seeds/seed.ts (script TypeORM CLI antiguo).
  DATABASE_URL: Joi.string().uri().allow('').optional(),
});
