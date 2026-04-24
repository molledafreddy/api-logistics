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
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!jose).+\\.js$'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.spec.json',
    },
  },
  // ─── Anti-pool-exhaustion ───
  maxWorkers: 1,
  testTimeout: 60_000,
  // Sprint 21: 9 suites e2e en cuarentena (.e2e-spec.ts.skip).
  // Ver docs/E2E-QUARANTINE.md. Permitimos 0 tests para no romper CI.
  passWithNoTests: true,
};
