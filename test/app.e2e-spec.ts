/**
 * Smoke test E2E — el más simple posible.
 *
 * Solo valida que AppModule arranca con la nueva infra:
 *   - Postgres local (Docker) en lugar de Supabase Pooler
 *   - Mock global de jwks-rsa (vía __mocks__/jwks-rsa.js)
 *   - E2E_TEST=true para bypass JWT en HTTP
 *
 * No requiere autenticación ni datos en BD: GET / es endpoint público.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestApp } from './helpers/test-app.helper';

describe('Root (e2e smoke)', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1 responde 200', async () => {
    const res = await request(app!.getHttpServer()).get('/api/v1');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/health responde 200', async () => {
    const res = await request(app!.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: expect.any(String) });
  });
});
