jest.setTimeout(60000);

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';

describe('Admin E2E', () => {
  let app: INestApplication;
  let jwt: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/dashboard - should return stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body).toHaveProperty('companies');
    expect(res.body).toHaveProperty('subscriptions');
    expect(res.body).toHaveProperty('verifications');
    expect(typeof res.body.companies).toBe('number');
  });

  it('GET /admin/companies - should list companies', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/companies')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /admin/companies/:id - should get a company', async () => {
    // Get a company ID first
    const list = await request(app.getHttpServer())
      .get('/admin/companies')
      .set('Authorization', `Bearer ${jwt}`);
    const companyId = list.body[0]?.id;
    expect(companyId).toBeDefined();

    const res = await request(app.getHttpServer())
      .get(`/admin/companies/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.id).toBe(companyId);
  });

  it('GET /admin/subscriptions - should list subscriptions', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/subscriptions')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /admin/verifications - should list verifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/verifications')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
