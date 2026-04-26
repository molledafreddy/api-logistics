import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';

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
