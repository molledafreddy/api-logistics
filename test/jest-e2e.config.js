module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!jose|jwks-rsa).+\\.js$'
  ],
// Archivo eliminado para evitar conflicto de configuración Jest.
// Este archivo ya no es necesario, solo jest.config.js será usado.
// ...existing code...
