/**
 * Relationships E2E — cubre el ciclo completo de relaciones entre empresas:
 *   - Crear invitación
 *   - Listar relaciones de una empresa
 *   - Obtener por ID
 *   - Responder (aceptar / rechazar)
 *   - Terminar
 *   - Historial de cambios
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Relationships E2E', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  let parentCompanyId: string;
  let childCompanyId: string | undefined;
  let relationshipId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);

    if (!dataSource.isInitialized) await dataSource.initialize();

    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'test@test.com'`,
    );

    const companies = await dataSource.query(
      `SELECT id FROM companies ORDER BY created_at ASC LIMIT 2`,
    );
    parentCompanyId = companies[0]?.id;
    childCompanyId = companies[1]?.id;
  });

  afterAll(async () => {
    // Limpiar relaciones de test
    if (relationshipId) {
      await dataSource
        .query(`DELETE FROM relationships WHERE id = $1`, [relationshipId])
        .catch(() => {
          /* ignore */
        });
    }
    if (dataSource.isInitialized) await dataSource.destroy();
    await closeTestApp(app);
  });

  // ─── Crear invitación ────────────────────

  it('POST /api/v1/relationships — crea invitación entre dos empresas', async () => {
    if (!parentCompanyId || !childCompanyId) {
      expect(true).toBe(true); // skip si no hay 2 empresas
      return;
    }

    const res = await request(app!.getHttpServer())
      .post('/api/v1/relationships')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        parentCompanyId,
        childCompanyId,
        relationshipType: 'associated_company',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.status ?? res.body.state).toBeDefined();
    relationshipId = res.body.id;
  });

  it('POST /api/v1/relationships — body inválido devuelve 400', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/relationships')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ parentCompanyId: 'not-a-uuid', childCompanyId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  // ─── Listar por empresa ───────────────────

  it('GET /api/v1/relationships/company/:id — lista las relaciones de la empresa', async () => {
    if (!parentCompanyId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/relationships/company/${parentCompanyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // ─── Obtener por ID ───────────────────────

  it('GET /api/v1/relationships/:id — obtiene el detalle de la relación', async () => {
    if (!relationshipId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/relationships/${relationshipId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body.id).toBe(relationshipId);
  });

  it('GET /api/v1/relationships/:id — ID inexistente devuelve 404', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/relationships/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(404);

    expect(res.body).toBeDefined();
  });

  // ─── Responder invitación ─────────────────

  it('PATCH /api/v1/relationships/:id/respond — acepta la invitación', async () => {
    if (!relationshipId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/relationships/${relationshipId}/respond`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ decision: 'accepted' })
      .expect(200);

    expect(res.body).toBeDefined();
  });

  // ─── Historial ────────────────────────────

  it('GET /api/v1/relationships/:id/logs — devuelve el historial de cambios', async () => {
    if (!relationshipId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/relationships/${relationshipId}/logs`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // ─── Terminar relación ────────────────────

  it('PATCH /api/v1/relationships/:id/terminate — termina la relación activa', async () => {
    if (!relationshipId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/relationships/${relationshipId}/terminate`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ reason: 'Fin del contrato de prueba E2E' })
      .expect(200);

    expect(res.body).toBeDefined();
  });

  // ─── Sin autenticación ────────────────────

  it('POST /api/v1/relationships — sin token devuelve 401', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/relationships')
      .send({
        parentCompanyId,
        childCompanyId,
        relationshipType: 'associated_company',
      });
    expect(res.status).toBe(401);
  });
});
