import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { TestAuthGuard } from './test-auth.guard';
import request from 'supertest';

/**
 * Creates a NestJS test application with the JwtAuthGuard replaced by TestAuthGuard.
 * This avoids the JWKS/Passport hanging issue in E2E tests.
 *
 * We import AppModule but override ALL APP_GUARD providers by re-declaring them.
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
  await app.init();
  return app;
}

/**
 * Logs in via the real Supabase auth and returns the access token.
 */
export async function getAccessToken(
  app: INestApplication,
  email = process.env.TEST_USER_EMAIL || 'molledafreddy@gmail.com',
  password = process.env.TEST_USER_PASSWORD || 'MyP@ssw0rd!',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

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
