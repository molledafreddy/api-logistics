/**
 * Setup file para E2E tests: mocks globales.
 *
 * Corre con Jest bootstrapping → `jest.mock()` está disponible.
 * Se cargan vía `setupFiles` en jest.config.e2e.cjs ANTES de compilar
 * los archivos de tests.
 *
 * Responsabilidad:
 *   - jest.mock('jwks-rsa') para desbloquear SupabaseJwtStrategy en boot.
 */

jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: class JwksClient {
    constructor(_opts: any) {}

    getSigningKey(_kid: any, callback?: any) {
      const signingKey = {
        getPublicKey: () => 'test-public-key',
        publicKey: 'test-public-key',
      };
      if (typeof callback === 'function') {
        callback(null, signingKey);
      }
      return Promise.resolve(signingKey);
    }
  },
  JwksClient: class JwksClient {
    constructor(_opts: any) {}

    getSigningKey(_kid: any, callback?: any) {
      const signingKey = {
        getPublicKey: () => 'test-public-key',
        publicKey: 'test-public-key',
      };
      if (typeof callback === 'function') {
        callback(null, signingKey);
      }
      return Promise.resolve(signingKey);
    }
  },
  passportJwtSecret: () => (_req: any, _payload: any, done: any) => {
    if (typeof done === 'function') done(null, 'test-secret');
  },
}));
