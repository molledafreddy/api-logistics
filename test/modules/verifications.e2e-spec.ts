jest.setTimeout(60000);

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Verifications E2E', () => {
  let app: INestApplication;
  let jwt: string;
  let companyId: string;
  let tierId: string;
  let verificationId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
    if (!dataSource.isInitialized) await dataSource.initialize();
    const res = await dataSource.query(`SELECT id FROM companies LIMIT 1`);
    companyId = res[0]?.id;
    if (!companyId) throw new Error('No company found for tests');
    // Ensure test user is super_admin for full access
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'molledafreddy@gmail.com'`,
    );
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await app.close();
  });

  it('POST /verifications/tiers - should create a verification tier', async () => {
    const res = await request(app.getHttpServer())
      .post('/verifications/tiers')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        code: `tier-${suffix}`,
        name: `Tier ${suffix}`,
        description: 'E2E test tier',
      })
      .expect(201);
    tierId = res.body.id;
    expect(tierId).toBeDefined();
    expect(res.body.code).toBe(`tier-${suffix}`);
  });

  it('GET /verifications/tiers - should list tiers', async () => {
    const res = await request(app.getHttpServer())
      .get('/verifications/tiers')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /verifications - should create a verification', async () => {
    const res = await request(app.getHttpServer())
      .post('/verifications')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ companyId, tierId })
      .expect(201);
    verificationId = res.body.id;
    expect(verificationId).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('GET /verifications/company/:companyId - should list company verifications', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verifications/company/${companyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /verifications/:id - should get verification by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verifications/${verificationId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.id).toBe(verificationId);
  });

  it('PATCH /verifications/:id/submit - should submit for review', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/verifications/${verificationId}/submit`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.status).toBe('in_review');
  });

  it('PATCH /verifications/:id/review - should approve verification', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/verifications/${verificationId}/review`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ decision: 'approved', reviewNotes: 'Looks good' })
      .expect(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.reviewedBy).toBeDefined();
  });

  it('POST /verifications/:id/documents - should add a document', async () => {
    const res = await request(app.getHttpServer())
      .post(`/verifications/${verificationId}/documents`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        documentType: 'license',
        fileUrl: 'https://example.com/doc.pdf',
        fileName: 'doc.pdf',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });

  it('GET /verifications/:id/documents - should list documents', async () => {
    const res = await request(app.getHttpServer())
      .get(`/verifications/${verificationId}/documents`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
