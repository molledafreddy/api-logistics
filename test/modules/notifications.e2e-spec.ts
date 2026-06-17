import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getAccessToken,
} from '../helpers/test-app.helper';

describe('Notifications E2E', () => {
  let app: INestApplication | undefined;
  let jwt: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/notifications - should list my notifications (empty initially)', async () => {
    const res = await request(app!.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('POST /api/v1/notifications/push-tokens - should register a push token', async () => {
    const res = await request(app!.getHttpServer())
      .post('/api/v1/notifications/push-tokens')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        token: `expo-token-${Date.now()}`,
        platform: 'ios',
        deviceName: 'test-device',
      })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.platform).toBe('ios');
  });

  it('PATCH /api/v1/notifications/read-all - should mark all as read', async () => {
    const res = await request(app!.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/v1/notifications/push-tokens/:token - should deactivate a push token', async () => {
    const token = `expo-remove-${Date.now()}`;
    // Register first
    await request(app!.getHttpServer())
      .post('/api/v1/notifications/push-tokens')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token, platform: 'android' })
      .expect(201);
    // Remove
    const res = await request(app!.getHttpServer())
      .delete(`/api/v1/notifications/push-tokens/${token}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
