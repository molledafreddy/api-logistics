jest.setTimeout(60000);

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAccessToken } from '../helpers/test-app.helper';

describe('Notifications E2E', () => {
  let app: INestApplication;
  let jwt: string;
  let notificationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /notifications - should list my notifications (empty initially)', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /notifications/push-tokens - should register a push token', async () => {
    const res = await request(app.getHttpServer())
      .post('/notifications/push-tokens')
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

  it('PATCH /notifications/read-all - should mark all as read', async () => {
    const res = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /notifications/push-tokens/:token - should deactivate a push token', async () => {
    const token = `expo-remove-${Date.now()}`;
    // Register first
    await request(app.getHttpServer())
      .post('/notifications/push-tokens')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token, platform: 'android' })
      .expect(201);
    // Remove
    const res = await request(app.getHttpServer())
      .delete(`/notifications/push-tokens/${token}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
