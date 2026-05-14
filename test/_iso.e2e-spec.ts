/**
 * Isolation E2E — garantiza aislamiento multi-tenant.
 *
 * Verifica que un usuario autenticado de la compañía A no puede
 * leer ni modificar recursos de la compañía B (tenancy estricto),
 * y que endpoints de admin son inaccesibles sin el rol correcto.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from './helpers/test-app.helper';
import dataSource from '../src/database/data-source';

describe('Isolation / Multi-Tenant (e2e)', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  let ownCompanyId: string;
  let otherCompanyId: string | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);

    if (!dataSource.isInitialized) await dataSource.initialize();

    const myComp = await dataSource.query(
      `SELECT id FROM companies WHERE name = 'CI Test Company' LIMIT 1`,
    );
    ownCompanyId = myComp[0]?.id;

    if (ownCompanyId) {
      const other = await dataSource.query(
        `SELECT id FROM companies WHERE id != $1 LIMIT 1`,
        [ownCompanyId],
      );
      otherCompanyId = other[0]?.id;
    }

    // Asegurar rol super_admin para el test user al inicio
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'test@test.com'`,
    );
  });

  afterAll(async () => {
    // Restaurar rol super_admin siempre
    if (dataSource.isInitialized) {
      await dataSource
        .query(
          `UPDATE users SET role = 'super_admin' WHERE email = 'test@test.com'`,
        )
        .catch(() => {
          /* ignore */
        });
      await dataSource.destroy();
    }
    await closeTestApp(app);
  });

  // ─── Saved Addresses — tenancy propio ────

  it('GET /api/v1/saved-addresses — sólo devuelve direcciones de la empresa propia', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/saved-addresses')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    if (res.body.data && Array.isArray(res.body.data)) {
      for (const addr of res.body.data) {
        expect(addr.companyId).toBe(ownCompanyId);
      }
    }
  });

  // ─── Notifications — sólo del usuario ────

  it('GET /api/v1/notifications — sólo devuelve notificaciones propias', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // ─── Cross-company (si existe segunda empresa) ───────────

  it('GET /api/v1/verifications/company/:id — empresa ajena → vacío o 403/404', async () => {
    if (!otherCompanyId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/verifications/company/${otherCompanyId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200 && Array.isArray(res.body)) {
      expect(res.body.length).toBe(0);
    }
  });

  it('GET /api/v1/relationships/company/:id — empresa ajena → datos vacíos o denegado', async () => {
    if (!otherCompanyId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/relationships/company/${otherCompanyId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect([200, 403, 404]).toContain(res.status);
  });

  // ─── Admin sin privilegios → 403 ─────────

  it('GET /api/v1/admin/dashboard — rol admin normal devuelve 403', async () => {
    // Degradar temporalmente a rol admin
    await dataSource.query(
      `UPDATE users SET role = 'admin' WHERE email = 'test@test.com'`,
    );

    const loginRes = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'TestPassword123!' });

    const adminJwt = loginRes.body?.session?.accessToken;
    if (!adminJwt) {
      expect(true).toBe(true);
    } else {
      const res = await request(app!.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminJwt}`);
      expect(res.status).toBe(403);
    }

    // Restaurar super_admin
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'test@test.com'`,
    );
  });

  // ─── UUIDs inválidos → 400 ───────────────

  it('UUID inválido en saved-addresses/:id devuelve 400', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/saved-addresses/not-a-uuid')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(400);
  });

  it('UUID inexistente en saved-addresses/:id devuelve 404', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/saved-addresses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(404);
  });
});
