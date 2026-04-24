jest.setTimeout(60000);

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Subscriptions Addons E2E', () => {
  let app: INestApplication;
  let subscriptionId: string;
  let addonId: string;
  let jwt: string;
  let companyId: string;
  let planId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);

    // Inicializar dataSource si es necesario
    if (!dataSource.isInitialized) await dataSource.initialize();
    const companyRes = await dataSource.query(
      `SELECT id FROM companies WHERE name = $1 LIMIT 1`,
      ['Test Company'],
    );
    companyId = companyRes[0]?.id;
    const planRes = await dataSource.query(
      `SELECT id FROM plans WHERE name = $1 LIMIT 1`,
      ['Business'],
    );
    planId = planRes[0]?.id;
    if (!companyId || !planId)
      throw new Error('No se encontraron companyId o planId válidos');
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await app.close();
  });

  it('should create a free subscription', async () => {
    console.log('E2E LOG: Antes de POST /subscriptions/free');
    const res = await request(app.getHttpServer())
      .post('/subscriptions/free')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ companyId, planId })
      .expect(201);
    console.log(
      'E2E LOG: Después de POST /subscriptions/free',
      res.status,
      res.body,
    );
    subscriptionId = res.body.id || res.body.subscription?.id;
    expect(subscriptionId).toBeDefined();
  });

  it('should add an addon', async () => {
    console.log('E2E LOG: Antes de POST /subscriptions/:id/addons');
    const res = await request(app.getHttpServer())
      .post(`/subscriptions/${subscriptionId}/addons`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ addon_type: 'extra_users', quantity: 3 })
      .expect(201);
    console.log(
      'E2E LOG: Después de POST /subscriptions/:id/addons',
      res.status,
      res.body,
    );
    addonId = res.body.id;
    expect(res.body).toMatchObject({ addon_type: 'extra_users', quantity: 3 });
  });

  it('should get addons by subscription', async () => {
    console.log('E2E LOG: Antes de GET /subscriptions/:id/addons');
    const res = await request(app.getHttpServer())
      .get(`/subscriptions/${subscriptionId}/addons`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    console.log(
      'E2E LOG: Después de GET /subscriptions/:id/addons',
      res.status,
      res.body,
    );
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('addon_type');
  });

  it('should update an addon', async () => {
    console.log('E2E LOG: Antes de PATCH /subscriptions/addons/:id');
    const res = await request(app.getHttpServer())
      .patch(`/subscriptions/addons/${addonId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ quantity: 5 })
      .expect(200);
    console.log(
      'E2E LOG: Después de PATCH /subscriptions/addons/:id',
      res.status,
      res.body,
    );
    expect(res.body.quantity).toBe(5);
  });

  it('should get addon by id', async () => {
    console.log('E2E LOG: Antes de GET /subscriptions/addons/:id');
    const res = await request(app.getHttpServer())
      .get(`/subscriptions/addons/${addonId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    console.log(
      'E2E LOG: Después de GET /subscriptions/addons/:id',
      res.status,
      res.body,
    );
    expect(res.body.id).toBe(addonId);
  });

  it('should remove addon', async () => {
    console.log('E2E LOG: Antes de PATCH /subscriptions/addons/:id/delete');
    const res = await request(app.getHttpServer())
      .patch(`/subscriptions/addons/${addonId}/delete`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    console.log(
      'E2E LOG: Después de PATCH /subscriptions/addons/:id/delete',
      res.status,
      res.body,
    );
    expect(res.body.affected).toBe(1);
  });
});
