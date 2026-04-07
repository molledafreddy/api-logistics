// ─── App Constants ──────────────────────────
export const APP_NAME = 'API-Logistics';

// ─── Pagination Defaults ────────────────────
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// ─── JWT ────────────────────────────────────
export const JWT_ACCESS_STRATEGY = 'jwt-access';
export const JWT_REFRESH_STRATEGY = 'jwt-refresh';

// ─── Cache TTLs (seconds) ───────────────────
export const CACHE_TTL = {
  USER_CONTEXT: 300,      // 5 min
  COMPANY: 600,           // 10 min
  PLAN: 3600,             // 1 hour
  PERMISSIONS: 3600,      // 1 hour
  DASHBOARD: 60,          // 1 min
  RESOURCE_COUNT: 300,    // 5 min
} as const;

// ─── File Upload ────────────────────────────
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// ─── Pre-signed URL TTLs (seconds) ─────────
export const PRESIGNED_URL_TTL = {
  UPLOAD: 900,   // 15 min
  DOWNLOAD: 3600, // 1 hour
} as const;

// ─── Rate Limits ────────────────────────────
export const RATE_LIMITS = {
  LOGIN: { ttl: 900000, limit: 5 },          // 5 intentos en 15 min
  REGISTER: { ttl: 3600000, limit: 3 },      // 3 registros por hora
  FORGOT_PASSWORD: { ttl: 3600000, limit: 3 }, // 3 por hora
  API_DEFAULT: { ttl: 60000, limit: 100 },   // 100 por minuto
} as const;
