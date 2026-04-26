/**
 * Mock global de `jwks-rsa` para E2E tests.
 *
 * Reemplaza:
 *   - JwksClient (usado por WsAuthService): no hace fetch real, devuelve key dummy
 *   - passportJwtSecret (usado por SupabaseJwtStrategy): igual
 *
 * Esto desbloquea AppModule en E2E sin tocar Supabase Auth.
 * La verificación real de JWT (en E2E_TEST=true) ocurre vía
 * jwt-auth.guard.validateDirectly() que sí llama a Supabase /auth/v1/user.
 */

class JwksClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts) {}

  // jsonwebtoken pasa (header, callback) → callback(err, signingKey)
  getSigningKey(_kid, callback) {
    if (typeof _kid === 'function') {
      callback = _kid;
    }
    if (typeof callback === 'function') {
      callback(null, {
        getPublicKey: () => 'test-public-key',
        publicKey: 'test-public-key',
      });
    }
    return Promise.resolve({
      getPublicKey: () => 'test-public-key',
      publicKey: 'test-public-key',
    });
  }
}

const passportJwtSecret = jest.fn(
  () => (_req, _payload, done) => {
    if (typeof done === 'function') done(null, 'test-secret');
  },
);

module.exports = {
  __esModule: true,
  default: JwksClient,
  JwksClient,
  passportJwtSecret,
};
