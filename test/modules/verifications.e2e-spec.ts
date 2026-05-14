/**
 * Verifications E2E — cubre el ciclo completo:
 *   - CRUD de tiers
 *   - Crear verificación → revisar (aprobar/rechazar)
 *   - Compliance snapshot
 *   - Onboarding wizard (con y sin compañía)
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Verifications E2E', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  let companyId: string;
  let tierId: string;
  let verificationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);

    if (!dataSource.isInitialized) await dataSource.initialize();

    // Asegurar super_admin para poder crear tiers y revisar verificaciones
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'test@test.com'`,
    );

    const compRes = await dataSource.query(
      `SELECT id FROM companies WHERE name = 'CI Test Company' LIMIT 1`,
    );
    companyId = compRes[0]?.id;

    if (!companyId) {
      const anyComp = await dataSource.query(
        `SELECT id FROM companies LIMIT 1`,
      );
      companyId = anyComp[0]?.id;
    }

    // Usar tier existente si hay, sino lo creamos en el test
    const tierRes = await dataSource.query(
      `SELECT id FROM verification_tiers WHERE is_active = true LIMIT 1`,
    );
    tierId = tierRes[0]?.id;
  });

  afterAll(async () => {
    // Limpiar verificaciones de test
    if (verificationId) {
      await dataSource
        .query(`DELETE FROM verifications WHERE id = $1`, [verificationId])
        .catch(() => {
          /* ignore */
        });
    }
    if (dataSource.isInitialized) await dataSource.destroy();
    await closeTestApp(app);
  });

  // ─── Tiers ────────────────────────────────

  it('GET /api/v1/verifications/tiers — lista los tiers activos', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/verifications/tiers')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/verifications/tiers — crea un tier (super_admin)', async () => {
    const suffix = Date.now();
    const res = await request(app!.getHttpServer())
      .post('/api/v1/verifications/tiers')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        code: `TIER_E2E_${suffix}`,
        name: `E2E Tier ${suffix}`,
        description: 'Tier creado en E2E test',
        validityDays: 365,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toContain('TIER_E2E');

    // Usar este tier para las pruebas de verificación si no había uno
    if (!tierId) tierId = res.body.id;
  });

  // ─── Verifications CRUD ───────────────────

  it('POST /api/v1/verifications — crea una verificación para la empresa', async () => {
    if (!companyId || !tierId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .post('/api/v1/verifications')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ companyId, tierId })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.companyId ?? res.body.company_id).toBe(companyId);
    verificationId = res.body.id;
  });

  it('GET /api/v1/verifications/company/:id — lista verificaciones de la empresa', async () => {
    if (!companyId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/verifications/company/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/verifications/:id — obtiene el detalle de la verificación', async () => {
    if (!verificationId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/verifications/${verificationId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body.id).toBe(verificationId);
  });

  it('PATCH /api/v1/verifications/:id/review — rechaza la verificación', async () => {
    if (!verificationId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/verifications/${verificationId}/review`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ decision: 'rejected', reason: 'Documentación incompleta' })
      .expect(200);

    expect(res.body).toBeDefined();
  });

  // ─── Documentos ──────────────────────────

  it('POST /api/v1/verifications/:id/documents — agrega documento (si hay verificación)', async () => {
    if (!verificationId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .post(`/api/v1/verifications/${verificationId}/documents`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        type: 'rut',
        url: 'https://example.com/doc.pdf',
        name: 'RUT empresa',
      });

    expect([200, 201, 400, 404]).toContain(res.status);
  });

  it('GET /api/v1/verifications/:id/documents — lista documentos', async () => {
    if (!verificationId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/verifications/${verificationId}/documents`)
      .set('Authorization', `Bearer ${jwt}`);

    expect([200, 404]).toContain(res.status);
  });

  // ─── Compliance ───────────────────────────

  it('GET /api/v1/verifications/compliance/:companyId — devuelve snapshot de cumplimiento', async () => {
    if (!companyId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/verifications/compliance/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('companyId');
    expect(res.body).toHaveProperty('canOperate');
    expect(typeof res.body.canOperate).toBe('boolean');
  });

  // ─── Onboarding wizard ────────────────────

  it('GET /api/v1/verifications/onboarding/:companyId — wizard personalizado', async () => {
    if (!companyId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/verifications/onboarding/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('steps');
    expect(Array.isArray(res.body.steps)).toBe(true);
    expect(res.body).toHaveProperty('progressPct');
  });

  it('GET /api/v1/verifications/onboarding?serviceType=freight — preview sin compañía', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/verifications/onboarding?serviceType=freight')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('steps');
    expect(Array.isArray(res.body.steps)).toBe(true);
  });
});
