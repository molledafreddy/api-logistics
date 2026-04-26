/**
 * Jest config — UNIT TESTS ONLY (paralelo).
 *
 * Excluye explícitamente cualquier `*.e2e-spec.ts` para que `pnpm test`
 * sea rápido y no toque la base de datos.
 *
 * Para E2E usar `pnpm test:e2e` (config separada con maxWorkers=1).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  // Sólo specs unitarios, NO e2e
  testMatch: ['<rootDir>/src/**/*.(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.e2e-spec\\.ts$'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!jose).+\\.js$'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.spec.json',
    },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'text-summary'],
  // ─── Test Reporting ───
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathAsClassName: true,
    }],
  ],
};
