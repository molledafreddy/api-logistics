import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // ─── App ──────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  APP_PORT: Joi.alternatives()
    .try(Joi.number(), Joi.string().allow(''))
    .default(3000),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  APP_NAME: Joi.string().default('API-Logistics'),
  APP_VERSION: Joi.string().default('1.0.0'),
  API_PREFIX: Joi.string().default('v1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3001'),

  // ─── Database ─────────────────────────────
  // Individual vars optional when DATABASE_URL is present (Railway/production)
  DATABASE_URL: Joi.string().allow('').optional(),
  DB_HOST: Joi.string().optional().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().optional().default('logistics_dev'),
  DB_USER: Joi.string().optional().default('logistics'),
  DB_PASSWORD: Joi.string().allow('').optional().default(''),
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
  // Optional when STORAGE_PROVIDER=local
  S3_ENDPOINT: Joi.string().uri().allow('').optional().default(''),
  S3_ACCESS_KEY: Joi.string().allow('').optional().default(''),
  S3_SECRET_KEY: Joi.string().allow('').optional().default(''),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET_AVATARS: Joi.string().default('logistics-avatars'),
  S3_BUCKET_DOCUMENTS: Joi.string().default('logistics-documents'),
  S3_BUCKET_RECEIPTS: Joi.string().default('logistics-receipts'),
  S3_BUCKET_CHAT: Joi.string().default('logistics-chat'),
  S3_BUCKET_EXPORTS: Joi.string().default('logistics-exports'),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),

  // ─── Email (Resend) ──────────────────────
  RESEND_API_KEY: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().default('Logistics App <onboarding@resend.dev>'),
  // Legacy SMTP — ya no se usan con Resend, se mantienen opcionales por compatibilidad
  MAIL_HOST: Joi.string().allow('').default(''),
  MAIL_PORT: Joi.number().default(1025),
  MAIL_USER: Joi.string().allow('').default(''),
  MAIL_PASSWORD: Joi.string().allow('').default(''),
  MAIL_FROM_NAME: Joi.string().default('Logistics App'),

  // ─── Stripe (no activo — provider es MercadoPago) ───
  STRIPE_SECRET_KEY: Joi.string().allow('').default(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow('').default(''),

  // ─── Firebase ─────────────────────────────
  // Opción A: credenciales explícitas (recomendado para producción sin GCP).
  FIREBASE_PROJECT_ID: Joi.string().allow('').default(''),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').default(''),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').default(''),
  // Opción B: path al JSON de service account (applicationDefault fallback).
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string().allow('').default(''),

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

  // ─── Geocoding (Sprint C) ─────────────────
  // Provider activo. 'mapbox' requiere MAPBOX_TOKEN; 'mock' devuelve fixtures
  // determinísticos (útil en dev/test sin cuenta).
  GEOCODING_PROVIDER: Joi.string().valid('mapbox', 'mock').default('mock'),
  // Token Mapbox (cuenta Free alcanza para arrancar). Dejar vacío con provider=mock.
  MAPBOX_TOKEN: Joi.string().allow('').default(''),
  // País por defecto para sesgar autocomplete (ISO 3166-1 alpha-2). Chile = 'cl'.
  GEOCODING_DEFAULT_COUNTRY: Joi.string().length(2).lowercase().default('cl'),
  // TTL del cache de resultados de geocoding en segundos. Mapbox permite cachear 30 días;
  // 24 h es un balance razonable entre frescura y consumo de cuota.
  GEOCODING_CACHE_TTL_SEC: Joi.number().integer().min(60).default(86400),
  // Rate limit de llamadas al provider externo por IP/usuario por minuto.
  GEOCODING_RATE_LIMIT_PER_MIN: Joi.number().integer().min(1).default(60),

  // ─── Mapbox Optimization (Sprint C.4) ─────
  // Profile de routing: 'mapbox/driving-traffic' (default), 'mapbox/driving',
  // 'mapbox/walking', 'mapbox/cycling'.
  MAPBOX_OPTIMIZATION_PROFILE: Joi.string().default('mapbox/driving-traffic'),
  // Timeout para la llamada a Mapbox Optimization v1 (ms). Si se excede,
  // fallback transparente a Haversine.
  MAPBOX_OPTIMIZATION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(15000),

  // ─── Payments (Sprint E) ──────────────────
  // Provider activo. 'mercadopago' requiere MERCADOPAGO_ACCESS_TOKEN; 'mock'
  // devuelve URLs determinísticas (útil en dev/test sin cuenta).
  PAYMENTS_PROVIDER: Joi.string().valid('mercadopago', 'mock').default('mock'),
  // Access token de MercadoPago (Bearer). Dev: TEST-...; Prod: APP_USR-...
  MERCADOPAGO_ACCESS_TOKEN: Joi.string().allow('').default(''),
  // Secret para verificar firma HMAC del webhook (panel MP → Webhooks → Secret).
  MERCADOPAGO_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  // URL pública del webhook (debe ser https en prod).
  MERCADOPAGO_NOTIFICATION_URL: Joi.string().uri().allow('').default(''),
  // back_urls del checkout
  MERCADOPAGO_SUCCESS_URL: Joi.string()
    .uri()
    .default('http://localhost:3001/billing/success'),
  MERCADOPAGO_FAILURE_URL: Joi.string()
    .uri()
    .default('http://localhost:3001/billing/failure'),
  MERCADOPAGO_PENDING_URL: Joi.string()
    .uri()
    .default('http://localhost:3001/billing/pending'),
  // Timeout HTTP para llamadas a la API de MP (ms).
  MERCADOPAGO_TIMEOUT_MS: Joi.number().integer().min(1000).default(8000),

  // ─── Legacy / optional ────────────────────
  // (DATABASE_URL now declared in the DB section above)
});
