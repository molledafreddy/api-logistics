/**
 * Jest config — E2E TESTS (serial).
 *
 * Los e2e arrancan AppModule completo en cada suite (con su propio pool
 * TypeORM). Si los corremos en paralelo, agotamos las conexiones del
 * pooler de Supabase (MaxClientsInSessionMode).
 *
 * Por eso forzamos `maxWorkers: 1` (suite por suite) y un timeout
 * generoso para la inicialización de la app.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
        // isolatedModules vive en tsconfig.spec.json (compilerOptions).
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!jose).+\\.js$'],
  // Setup global ANTES del framework:
  //   1. setup-e2e-mocks.ts → jest.mock('jwks-rsa') con Jest context
  //   2. setup-e2e.ts → process.env.E2E_TEST=true, NODE_ENV=test
  setupFiles: [
    '<rootDir>/test/setup-e2e-mocks.ts',
    '<rootDir>/test/setup-e2e.ts',
  ],
  // ─── Anti-pool-exhaustion ───
  maxWorkers: 1,
  testTimeout: 60_000,
  // Cierra Jest aunque queden handles abiertos (TypeORM pool, BullMQ workers).
  // TODO: limpiar handles correctamente en afterAll para quitar este flag.
  forceExit: true,
  // Sprint 21: 9 suites e2e en cuarentena (.e2e-spec.ts.skip).
  // Ver docs/E2E-QUARANTINE.md. Permitimos 0 tests para no romper CI.
  passWithNoTests: true,
};
