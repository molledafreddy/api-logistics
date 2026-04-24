import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';

jest.setTimeout(60000);

describe('Plans & Permissions (e2e)', () => {
  let app: INestApplication;
  let jwt: string;
  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/plans (GET) - requiere plans.read', async () => {
    const res = await request(app.getHttpServer())
      .get('/plans')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/plans (POST) - requiere plans.write', async () => {
    const res = await request(app.getHttpServer())
      .post('/plans')
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

  it('/plans/permissions (GET) - requiere permissions.read', async () => {
    const res = await request(app.getHttpServer())
      .get('/plans/permissions')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/plans/permissions (POST) - requiere permissions.write', async () => {
    const res = await request(app.getHttpServer())
      .post('/plans/permissions')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ code: `e2e.test.${uniqueSuffix}`, description: 'E2E test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
