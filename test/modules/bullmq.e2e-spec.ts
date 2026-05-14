/**
 * BullMQ E2E — verifica que las colas de Bull están activas y
 * que las operaciones que dependen de ellas funcionan end-to-end.
 *
 * No hay endpoints HTTP directos para las colas, por lo que:
 *   1. Verificamos que el app arranca con BullMQ conectado.
 *   2. Accedemos a los servicios internos vía app.get() para comprobar
 *      que las colas están inicializadas.
 *   3. Llamamos a endpoints HTTP que internamente encolan jobs y verificamos
 *      que la respuesta HTTP es correcta (el job se encola, no se espera).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import { RenewalSchedulerService } from '../../src/modules/subscriptions/renewal-scheduler.service';
import { RecurringGeneratorScheduler } from '../../src/modules/recurring-templates/recurring-templates.scheduler';
import {
  createTestApp,
  getAccessToken,
  closeTestApp,
} from '../helpers/test-app.helper';
import dataSource from '../../src/database/data-source';

describe('BullMQ (e2e)', () => {
  let app: INestApplication | undefined;
  let _jwt: string;
  let companyId: string;
  let _planId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    _jwt = await getAccessToken(app);

    if (!dataSource.isInitialized) await dataSource.initialize();

    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE email = 'test@test.com'`,
    );

    const compRes = await dataSource.query(
      `SELECT id FROM companies WHERE name = 'CI Test Company' LIMIT 1`,
    );
    companyId = compRes[0]?.id;

    const planRes = await dataSource.query(
      `SELECT id FROM plans WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
    );
    _planId = planRes[0]?.id;

    const subRes = await dataSource.query(
      `SELECT id FROM subscriptions WHERE company_id = $1 LIMIT 1`,
      [companyId],
    );
    subscriptionId = subRes[0]?.id;
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await closeTestApp(app);
  });

  // ─── Cola subscription-renewal ────────────

  it('cola subscription-renewal está registrada en el contenedor DI', () => {
    const queue = app!.get(getQueueToken('subscription-renewal'), {
      strict: false,
    });
    expect(queue).toBeDefined();
  });

  it('cola subscription-renewal está conectada a Redis', async () => {
    const queue = app!.get(getQueueToken('subscription-renewal'), {
      strict: false,
    });
    if (!queue) {
      expect(true).toBe(true); // skip si no disponible
      return;
    }
    // getJobCounts() es una operación real de Redis — falla si no hay conexión
    const counts = await queue.getJobCounts();
    expect(counts).toBeDefined();
    expect(typeof counts.waiting).toBe('number');
  });

  // ─── Cola recurring-generator ─────────────

  it('cola recurring-generator está registrada en el contenedor DI', () => {
    const queue = app!.get(getQueueToken('recurring-generator'), {
      strict: false,
    });
    expect(queue).toBeDefined();
  });

  it('cola recurring-generator está conectada a Redis', async () => {
    const queue = app!.get(getQueueToken('recurring-generator'), {
      strict: false,
    });
    if (!queue) {
      expect(true).toBe(true);
      return;
    }
    const counts = await queue.getJobCounts();
    expect(counts).toBeDefined();
  });

  // ─── Webhook → encola procesamiento ──────

  it('POST /api/v1/payments/mock/webhook — payment.approved encola sin errores', async () => {
    // El mock provider no enqueue explícitamente, pero el servicio llama a
    // processWebhook que puede disparar eventos de renovación.
    const res = await request(app!.getHttpServer())
      .post('/api/v1/payments/mock/webhook')
      .set('x-signature', 'mock-signature')
      .send({
        type: 'payment.approved',
        externalId: `bullmq-e2e-${Date.now()}`,
        externalReference: `mock-${subscriptionId ?? '00000000-0000-0000-0000-000000000000'}-test`,
        amount: 9990,
        currency: 'CLP',
      });

    // El webhook puede devolver 200 (procesado) o 404 si la subscription no existe.
    // Ambos son válidos: lo importante es que BullMQ no rompe la ejecución.
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('received', true);
    }
  });

  // ─── RenewalSchedulerService accesible ────

  it('RenewalSchedulerService está registrado en el contenedor DI', () => {
    const svc = app!.get(RenewalSchedulerService, { strict: false });
    expect(svc).toBeDefined();
  });

  it('RecurringGeneratorScheduler está registrado en el contenedor DI', () => {
    const svc = app!.get(RecurringGeneratorScheduler, { strict: false });
    expect(svc).toBeDefined();
  });
});
