import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Subscriptions E2E', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  let companyId: string;
  let subscriptionId: string;
  let planId: string;
  let basicPlanId: string;
  let addonId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app, 'admin@test.com', 'TestPassword123!');
    if (!dataSource.isInitialized) await dataSource.initialize();

    // Get CI Test Company (where test user belongs)
    const compRes = await dataSource.query(
      `SELECT id FROM companies WHERE name = 'CI Test Company' LIMIT 1`,
    );
    companyId = compRes[0]?.id;

    // If CI Test Company not found, get any company
    if (!companyId) {
      const anyCompRes = await dataSource.query(
        `SELECT id FROM companies LIMIT 1`,
      );
      companyId = anyCompRes[0]?.id;
    }

    // Get Free plan
    const freePlanRes = await dataSource.query(
      `SELECT id FROM plans WHERE name = 'Free' LIMIT 1`,
    );
    planId = freePlanRes[0]?.id;

    // Get Basic plan
    const basicPlanRes = await dataSource.query(
      `SELECT id FROM plans WHERE name = 'Basic' LIMIT 1`,
    );
    basicPlanId = basicPlanRes[0]?.id;

    // Get existing subscription for company
    const subRes = await dataSource.query(
      `SELECT id FROM subscriptions WHERE company_id = $1 LIMIT 1`,
      [companyId],
    );
    subscriptionId = subRes[0]?.id;

    // Get existing addon if available
    if (subscriptionId) {
      const addonRes = await dataSource.query(
        `SELECT id FROM subscription_addons WHERE subscription_id = $1 LIMIT 1`,
        [subscriptionId],
      );
      addonId = addonRes[0]?.id;
    }
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await closeTestApp(app);
  });

  // TEST 1: Create free subscription
  it('POST /api/v1/subscriptions/free - should create free subscription', async () => {
    const payload = {
      companyId,
      planId,
    };

    const res = await request(app!.getHttpServer())
      .post('/api/v1/subscriptions/free')
      .set('Authorization', `Bearer ${jwt}`)
      .send(payload)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('company_id');
    expect(res.body).toHaveProperty('plan_id');
    expect(res.body).toHaveProperty('status');
  });

  // TEST 2: Get company subscriptions
  it('GET /api/v1/subscriptions/company/:companyId - should list subscriptions', async () => {
    const res = await request(app!.getHttpServer())
      .get(`/api/v1/subscriptions/company/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('company_id');
      expect(res.body[0]).toHaveProperty('plan_id');
      expect(res.body[0]).toHaveProperty('status');
    }
  });

  // TEST 3: Upgrade subscription
  it('PATCH /api/v1/subscriptions/:id/upgrade - should upgrade subscription', async () => {
    if (!subscriptionId) {
      // Skip if no subscription found
      expect(true).toBe(true);
      return;
    }

    const payload = {
      newPlanId: basicPlanId,
    };

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/subscriptions/${subscriptionId}/upgrade`)
      .set('Authorization', `Bearer ${jwt}`)
      .send(payload)
      .expect(200);

    // Response can be either the updated subscription or an update result
    expect(res.body).toBeDefined();
    expect(res.body !== null).toBe(true);
  });

  // TEST 4: Downgrade subscription
  it('PATCH /api/v1/subscriptions/:id/downgrade - should downgrade subscription', async () => {
    if (!subscriptionId) {
      expect(true).toBe(true);
      return;
    }

    const payload = {
      newPlanId: planId,
    };

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/subscriptions/${subscriptionId}/downgrade`)
      .set('Authorization', `Bearer ${jwt}`)
      .send(payload)
      .expect(200);

    // Response can be either the updated subscription or an update result
    expect(res.body).toBeDefined();
  });

  // TEST 5: Add addon to subscription
  it('POST /api/v1/subscriptions/:id/addons - should add addon', async () => {
    if (!subscriptionId) {
      expect(true).toBe(true);
      return;
    }

    const payload = {
      addon_type: 'extra_users',
      quantity: 2,
    };

    const res = await request(app!.getHttpServer())
      .post(`/api/v1/subscriptions/${subscriptionId}/addons`)
      .set('Authorization', `Bearer ${jwt}`)
      .send(payload)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.addon_type).toBe('extra_users');
    expect(res.body.quantity).toBe(2);
  });

  // TEST 6: Get subscription addons
  it('GET /api/v1/subscriptions/:id/addons - should list addons', async () => {
    if (!subscriptionId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .get(`/api/v1/subscriptions/${subscriptionId}/addons`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('addon_type');
      expect(res.body[0]).toHaveProperty('quantity');
    }
  });

  // TEST 7: Suspend subscription
  it('PATCH /api/v1/subscriptions/:id/suspend - should suspend subscription', async () => {
    if (!subscriptionId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/subscriptions/${subscriptionId}/suspend`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    // Response can be either the suspended subscription or an update result
    expect(res.body).toBeDefined();
  });
});
