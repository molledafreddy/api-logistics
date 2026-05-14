/**
 * Sanity E2E — verifica los flujos más críticos del API:
 *   - Health + root endpoint
 *   - Login → JWT válido
 *   - Endpoint autenticado básico (GET /me)
 *   - Sin token → 401
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from './helpers/test-app.helper';

describe('Sanity (e2e)', () => {
  let app: INestApplication | undefined;
  let jwt: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ─── Infra ────────────────────────────────

  it('GET /api/v1 — root responde 200', async () => {
    const res = await request(app!.getHttpServer()).get('/api/v1');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/health — devuelve status ok', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body).toHaveProperty('status');
  });

  // ─── Auth ─────────────────────────────────

  it('POST /api/v1/auth/login — credenciales válidas devuelven JWT', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'TestPassword123!' })
      .expect(200);

    expect(res.body).toHaveProperty('session');
    expect(res.body.session).toHaveProperty('accessToken');
    expect(typeof res.body.session.accessToken).toBe('string');
  });

  it('POST /api/v1/auth/login — credenciales inválidas devuelven 401', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  // ─── Autenticación ────────────────────────

  it('GET /api/v1/auth/me — sin token devuelve 401', async () => {
    const res = await request(app!.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me — con token válido devuelve el usuario', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email');
  });

  it('cualquier endpoint protegido con token malformado devuelve 401', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });

  // ─── Plan catalog (endpoint público) ─────

  it('GET /api/v1/plans/catalog — sin token devuelve 200', async () => {
    const res = await request(app!.getHttpServer()).get(
      '/api/v1/plans/catalog',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
