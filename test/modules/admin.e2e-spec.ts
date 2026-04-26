import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Admin E2E', () => {
  let app: INestApplication | undefined;
  let jwt: string;
  let companyId: string;
  let companyId2: string;
  let verificationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
    if (!dataSource.isInitialized) await dataSource.initialize();

    // Get first company
    const compRes = await dataSource.query(`SELECT id FROM companies LIMIT 1`);
    companyId = compRes[0]?.id;

    // Get second company if available
    const comp2Res = await dataSource.query(
      `SELECT id FROM companies LIMIT 1 OFFSET 1`,
    );
    companyId2 = comp2Res[0]?.id;

    // Get a verification record
    const verRes = await dataSource.query(
      `SELECT id FROM verifications LIMIT 1`,
    );
    verificationId = verRes[0]?.id;

    // Ensure super admin role for test user
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'molledafreddy@gmail.com'`,
    );
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await closeTestApp(app);
  });

  // TEST 1: Get admin dashboard stats
  it('GET /api/v1/admin/dashboard - should return dashboard stats', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('companies');
    expect(res.body).toHaveProperty('subscriptions');
    expect(res.body).toHaveProperty('verifications');
    expect(typeof res.body.companies).toBe('number');
    expect(typeof res.body.subscriptions).toBe('number');
    expect(typeof res.body.verifications).toBe('number');
  });

  // TEST 2: List all companies with pagination
  it('GET /api/v1/admin/companies - should list all companies', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/admin/companies')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('status');
  });

  // TEST 3: Get specific company details
  it('GET /api/v1/admin/companies/:id - should get company details', async () => {
    const res = await request(app!.getHttpServer())
      .get(`/api/v1/admin/companies/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body.id).toBe(companyId);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('status');
  });

  // TEST 4: Update company data
  it('PATCH /api/v1/admin/companies/:id - should update company', async () => {
    const updatePayload = { name: 'Updated Company Name' };

    const res = await request(app!.getHttpServer())
      .patch(`/api/v1/admin/companies/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send(updatePayload)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Updated Company Name');
  });

  // TEST 5: List all subscriptions
  it('GET /api/v1/admin/subscriptions - should list all subscriptions', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/admin/subscriptions')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('plan_id');
      expect(res.body[0]).toHaveProperty('status');
    }
  });

  // TEST 6: List verifications
  it('GET /api/v1/admin/verifications - should list all verifications', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/admin/verifications')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('status');
    }
  });

  // TEST 7: List verifications with status filter
  it('GET /api/v1/admin/verifications?status=pending - should filter by status', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/admin/verifications?status=pending')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    // All returned items should have pending status if any exist
    if (res.body.length > 0) {
      res.body.forEach((item: any) => {
        expect(item.status).toMatch(/pending|review/i);
      });
    }
  });

  // TEST 8: Unauthorized access should fail
  it('GET /api/v1/admin/dashboard - should reject invalid token', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer invalid_token`)
      .expect(401);
  });
});
