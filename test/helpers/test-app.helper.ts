import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { TestAuthGuard } from './test-auth.guard';
import request from 'supertest';

/**
 * Creates a NestJS test application with:
 *   - jwks-rsa mocked vía setup-e2e.ts (antes de cualquier import)
 *   - E2E_TEST=true para bypass JWT real en JwtAuthGuard.validateDirectly()
 *   - setGlobalPrefix('api/v1') para coincidir con producción
 */
export async function createTestApp(): Promise<INestApplication> {
  // Set flag so AppModule can detect test mode if needed
  process.env.E2E_TEST = 'true';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // Mismo prefix que producción → todas las rutas se sirven en /api/v1/*
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

/**
 * Logs in via the real Supabase auth (dev) or local PostgreSQL (CI/CD).
 *
 * In CI/CD (NODE_ENV=test && CI=true), users are created directly in PostgreSQL
 * without Supabase Auth, so login uses password_hash matching.
 */
export async function getAccessToken(
  app: INestApplication,
  email?: string,
  password?: string,
): Promise<string> {
  const isCI = process.env.NODE_ENV === 'test' && process.env.CI === 'true';

  // Use CI test user credentials in CI/CD, otherwise use environment or dev defaults
  const defaultEmail = isCI
    ? 'test@test.com'
    : process.env.TEST_USER_EMAIL || 'molledafreddy@gmail.com';
  const defaultPassword = isCI
    ? 'TestPassword123!'
    : process.env.TEST_USER_PASSWORD || 'MyP@ssw0rd!';

  const finalEmail = email || defaultEmail;
  const finalPassword = password || defaultPassword;

  console.log(
    `[getAccessToken] isCI=${isCI}, email=${finalEmail}, NODE_ENV=${process.env.NODE_ENV}, CI=${process.env.CI}`,
  );

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: finalEmail, password: finalPassword });

  const jwt = res.body?.session?.accessToken;
  if (!jwt) {
    console.error('Login failed:', JSON.stringify(res.body, null, 2));
    throw new Error(
      `Could not get accessToken from login (status ${res.status})`,
    );
  }
  return jwt;
}

/**
 * Defensive teardown for E2E suites.
 *
 * Si `beforeAll` falla, `app` queda `undefined` y `afterAll` rompe con
 * "Cannot read properties of undefined (reading 'close')". Este helper
 * cierra el DataSource (TypeORM) y la app sin lanzar.
 */
export async function closeTestApp(
  app: INestApplication | undefined,
): Promise<void> {
  if (!app) return;
  try {
    // Cerrar DataSource (si está disponible) para liberar el pool de Supabase
    // antes de cerrar la app, evitando "MaxClientsInSessionMode".
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DataSource } = require('typeorm');
    const ds = app.get(DataSource, { strict: false });
    if (ds && ds.isInitialized) {
      await ds.destroy();
    }
  } catch {
    // ignore
  }
  try {
    await app.close();
  } catch {
    // ignore
  }
}
