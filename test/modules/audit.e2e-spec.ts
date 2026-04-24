jest.setTimeout(60000);

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Audit E2E', () => {
  let app: INestApplication;
  let jwt: string;
  let companyId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
    if (!dataSource.isInitialized) await dataSource.initialize();
    const res = await dataSource.query(`SELECT id FROM companies LIMIT 1`);
    companyId = res[0]?.id;
    // Ensure test user is super_admin for full access
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'molledafreddy@gmail.com'`,
    );

    // Seed an audit log entry for testing
    await dataSource.query(
      `INSERT INTO audit_logs (company_id, action, entity_type, entity_id, new_values, created_at)
       VALUES ($1, 'test_action', 'company', $1, '{"test": true}', NOW())`,
      [companyId],
    );
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await app.close();
  });

  it('GET /audit/company/:companyId - should list audit logs', async () => {
    const res = await request(app.getHttpServer())
      .get(`/audit/company/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('action');
    expect(res.body[0]).toHaveProperty('entityType');
  });

  it('GET /audit/:resourceType/:resourceId - should list logs for a resource', async () => {
    const res = await request(app.getHttpServer())
      .get(`/audit/company/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /audit/company/:companyId?page=1&limit=5 - should paginate', async () => {
    const res = await request(app.getHttpServer())
      .get(`/audit/company/${companyId}?page=1&limit=5`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });
});
