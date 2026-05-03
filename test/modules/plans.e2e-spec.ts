import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Plans & Permissions (e2e)', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/plans - requiere plans.read', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/plans')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/plans - requiere plans.write', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/plans')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        name: `E2E-${uniqueSuffix}`,
        price: 1,
        interval: 'month',
        is_active: true,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('GET /api/v1/plans/permissions - requiere permissions.read', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/plans/permissions')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/plans/permissions - requiere permissions.write', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/plans/permissions')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ code: `e2e.test.${uniqueSuffix}`, description: 'E2E test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});

// ─── Plan Limits CRUD (e2e) ───────────────────────────────────────────────────

describe('Plan Limits CRUD (e2e)', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  let planId: string;
  let limitId: string;
  const uniqueCode = `e2e_limit_${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);

    // Obtener un plan existente desde la BD de test
    if (!dataSource.isInitialized) await dataSource.initialize();
    const rows = await dataSource.query(
      `SELECT id FROM plans WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
    );
    planId = rows[0]?.id;
    if (!planId) throw new Error('No active plan found in DB for e2e test');
  });

  afterAll(async () => {
    // Limpiar el límite creado si no fue eliminado por el test de DELETE
    if (limitId) {
      await dataSource
        .query(`DELETE FROM plan_limits WHERE id = $1`, [limitId])
        .catch(() => {
          /* ya fue eliminado */
        });
    }
    await closeTestApp(app);
  });

  // 1. POST — crear un nuevo límite
  it('POST /api/v1/plans/:planId/limits — crea el límite (201)', async () => {
    const res = await request(app!.getHttpServer())
      .post(`/api/v1/plans/${planId}/limits`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ vertical: 'trucking', code: uniqueCode, value: 10 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.planId).toBe(planId);
    expect(res.body.vertical).toBe('trucking');
    expect(res.body.code).toBe(uniqueCode);
    expect(res.body.value).toBe(10);

    limitId = res.body.id;
  });

  // 2. POST duplicado — debe devolver 409 por unique constraint
  it('POST /api/v1/plans/:planId/limits — duplicado devuelve 409', async () => {
    const res = await request(app!.getHttpServer())
      .post(`/api/v1/plans/${planId}/limits`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ vertical: 'trucking', code: uniqueCode, value: 99 });

    expect(res.status).toBe(409);
  });

  // 3. POST con datos inválidos — debe devolver 400
  it('POST /api/v1/plans/:planId/limits — datos inválidos devuelven 400', async () => {
    const res = await request(app!.getHttpServer())
      .post(`/api/v1/plans/${planId}/limits`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ vertical: '', code: '', value: -1 }); // string vacío y valor negativo

    expect(res.status).toBe(400);
  });

  // 4. POST con plan inexistente — debe devolver 404
  it('POST /api/v1/plans/:planId/limits — plan inexistente devuelve 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app!.getHttpServer())
      .post(`/api/v1/plans/${fakeId}/limits`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ vertical: 'trucking', code: 'does_not_matter', value: 1 });

    expect(res.status).toBe(404);
  });

  // 5. GET — listar límites del plan
  it('GET /api/v1/plans/:planId/limits — lista los límites (200)', async () => {
    const res = await request(app!.getHttpServer())
      .get(`/api/v1/plans/${planId}/limits`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((l: any) => l.id === limitId);
    expect(found).toBeDefined();
    expect(found.code).toBe(uniqueCode);
  });

  // 6. GET sin auth — debe devolver 401
  it('GET /api/v1/plans/:planId/limits — sin token devuelve 401', async () => {
    const res = await request(app!.getHttpServer()).get(
      `/api/v1/plans/${planId}/limits`,
    );

    expect(res.status).toBe(401);
  });

  // 7. PATCH — actualizar el límite
  it('PATCH /api/v1/plans/limits/:id — actualiza el valor (200)', async () => {
    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/plans/limits/${limitId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ value: 50 });

    expect(res.status).toBe(200);
    expect(res.body.value).toBe(50);
    expect(res.body.id).toBe(limitId);
  });

  // 8. PATCH con id inexistente — debe devolver 404
  it('PATCH /api/v1/plans/limits/:id — id inexistente devuelve 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/plans/limits/${fakeId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ value: 99 });

    expect(res.status).toBe(404);
  });

  // 9. DELETE — eliminar el límite
  it('DELETE /api/v1/plans/limits/:id — elimina el límite (200)', async () => {
    const res = await request(app!.getHttpServer())
      .delete(`/api/v1/plans/limits/${limitId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true });
    limitId = ''; // marcar como eliminado para el cleanup
  });

  // 10. DELETE con id inexistente — debe devolver 404
  it('DELETE /api/v1/plans/limits/:id — id inexistente devuelve 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app!.getHttpServer())
      .delete(`/api/v1/plans/limits/${fakeId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
  });

  // 11. GET después del DELETE — el límite ya no aparece
  it('GET /api/v1/plans/:planId/limits — el límite eliminado ya no aparece', async () => {
    const res = await request(app!.getHttpServer())
      .get(`/api/v1/plans/${planId}/limits`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const found = res.body.find((l: any) => l.code === uniqueCode);
    expect(found).toBeUndefined();
  });
});

// ─── Sprint A — Catálogo público + límites efectivos (e2e) ────────────────────

describe('Plans Catalog Sprint A (e2e)', () => {
  let app: INestApplication | undefined;
  let jwt: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/plans/catalog — público, devuelve sólo planes con code', async () => {
    const res = await request(app!.getHttpServer()).get(
      '/api/v1/plans/catalog',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    // Todos deben tener code !== null y is_active === true
    for (const plan of res.body) {
      expect(plan.code).toBeTruthy();
      expect(plan.is_active).toBe(true);
    }
    // Debe incluir los planes Sprint A
    const codes = res.body.map((p: any) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'free_courier',
        'pro_courier',
        'free_passenger',
        'pro_passenger',
        'enterprise_fleet',
      ]),
    );
  });

  it('GET /api/v1/plans/catalog — el plan pro_courier tiene limits.global materializado', async () => {
    const res = await request(app!.getHttpServer()).get(
      '/api/v1/plans/catalog',
    );
    expect(res.status).toBe(200);
    const proCourier = res.body.find((p: any) => p.code === 'pro_courier');
    expect(proCourier).toBeDefined();
    expect(proCourier.audience).toBe('courier');
    expect(proCourier.tier).toBe('pro');
    expect(proCourier.limits).toBeDefined();
    expect(proCourier.limits.global).toBeDefined();
    expect(proCourier.limits.global.maxStopsPerOptimization).toBe(50);
  });

  it('GET /api/v1/plans/me/limits — autenticado, devuelve mapa de límites', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/plans/me/limits')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
    // Para el CI test user (Business plan legacy) puede ser {} o tener límites
    // legacy de plan_limits. Lo importante es que el endpoint responde.
  });

  it('GET /api/v1/plans/me/limits — sin auth devuelve 401', async () => {
    const res = await request(app!.getHttpServer()).get(
      '/api/v1/plans/me/limits',
    );
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/plans/:id/price — actualiza el precio (admin)', async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
    const rows = await dataSource.query(
      `SELECT id FROM plans WHERE code = 'free_passenger' LIMIT 1`,
    );
    const planId = rows[0]?.id;
    expect(planId).toBeDefined();

    const newPrice = Math.floor(Math.random() * 1000);
    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/plans/${planId}/price`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ price: newPrice });

    expect(res.status).toBe(200);
    expect(Number(res.body.price)).toBe(newPrice);
  });

  it('PATCH /api/v1/plans/:id/limits — sobrescribe el jsonb completo (admin)', async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
    const rows = await dataSource.query(
      `SELECT id FROM plans WHERE code = 'free_passenger' LIMIT 1`,
    );
    const planId = rows[0]?.id;
    expect(planId).toBeDefined();

    const newLimits = {
      global: { maxRidesPerDay: 99, customLimit: 7 },
    };
    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/plans/${planId}/limits`)
      .set('Authorization', `Bearer ${jwt}`)
      .send(newLimits);

    expect(res.status).toBe(200);
    expect(res.body.limits).toEqual(newLimits);
  });
});
