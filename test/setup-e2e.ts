/**
 * Setup global para suites E2E.
 *
 * Se carga vía `setupFiles` en jest.config.e2e.cjs → corre ANTES del
 * framework Jest (NO hay globals como `jest.mock` aquí; los node_modules
 * mocks viven en `__mocks__/` y se auto-cargan).
 *
 * Responsabilidades:
 *   1. Forzar E2E_TEST=true para que JwtAuthGuard use validateDirectly
 *      (bypass jwks-rsa en HTTP path).
 *   2. Asegurar NODE_ENV=test → ConfigModule carga `.env.test`.
 *
 * El mock de jwks-rsa vive en `__mocks__/jwks-rsa.js` (project root) y
 * Jest lo auto-aplica a cualquier `import 'jwks-rsa'`.
 */

process.env.E2E_TEST = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
