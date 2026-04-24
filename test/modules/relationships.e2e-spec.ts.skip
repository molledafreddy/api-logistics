jest.setTimeout(60000);

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('Relationships E2E', () => {
  let app: INestApplication;
  let jwt: string;
  let parentCompanyId: string;
  let childCompanyId: string;
  let relationshipId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
    if (!dataSource.isInitialized) await dataSource.initialize();

    // Get two different companies, or create a second one
    const companies = await dataSource.query(
      `SELECT id FROM companies ORDER BY created_at LIMIT 2`,
    );
    parentCompanyId = companies[0]?.id;
    if (companies.length > 1) {
      childCompanyId = companies[1]?.id;
    } else {
      // Create a second company for testing
      const suffix = Date.now();
      const res = await dataSource.query(
        `INSERT INTO companies (name, legal_name, tax_id, company_type, status) VALUES ($1, $2, $3, 'carrier', 'active') RETURNING id`,
        [`E2E Child ${suffix}`, `E2E Child Legal ${suffix}`, `TAX-${suffix}`],
      );
      childCompanyId = res[0].id;
    }
    if (!parentCompanyId || !childCompanyId)
      throw new Error('Need at least 2 companies');
    // Ensure test user is super_admin for full access
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'molledafreddy@gmail.com'`,
    );
    // Clean up any existing relationships between these companies
    await dataSource.query(
      `DELETE FROM company_relationship_logs WHERE relationship_id IN (SELECT id FROM company_relationships WHERE parent_company_id = $1 AND child_company_id = $2)`,
      [parentCompanyId, childCompanyId],
    );
    await dataSource.query(
      `DELETE FROM company_relationships WHERE parent_company_id = $1 AND child_company_id = $2`,
      [parentCompanyId, childCompanyId],
    );
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await app.close();
  });

  it('POST /relationships - should create a relationship invitation', async () => {
    const res = await request(app.getHttpServer())
      .post('/relationships')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        parentCompanyId,
        childCompanyId,
        relationshipType: 'covered_carrier',
        invitationEmail: 'test@example.com',
        invitationMessage: 'E2E test invitation',
      })
      .expect(201);
    relationshipId = res.body.id;
    expect(relationshipId).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('GET /relationships/company/:id - should list relationships for company', async () => {
    const res = await request(app.getHttpServer())
      .get(`/relationships/company/${parentCompanyId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /relationships/:id - should get relationship by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/relationships/${relationshipId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.id).toBe(relationshipId);
  });

  it('PATCH /relationships/:id/respond - should accept the invitation', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/relationships/${relationshipId}/respond`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ decision: 'accepted' })
      .expect(200);
    expect(res.body.status).toBe('accepted');
    expect(res.body.acceptedAt).toBeDefined();
  });

  it('GET /relationships/:id/logs - should have history logs', async () => {
    const res = await request(app.getHttpServer())
      .get(`/relationships/${relationshipId}/logs`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // created + accepted
  });

  it('PATCH /relationships/:id/terminate - should terminate the relationship', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/relationships/${relationshipId}/terminate`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ reason: 'E2E test termination' })
      .expect(200);
    expect(res.body.status).toBe('blocked');
    expect(res.body.terminatedAt).toBeDefined();
  });
});
