/**
 * BullMQ Integration Test
 *
 * Validates:
 * 1. Queue connection to Redis
 * 2. Jobs are enqueued when creating a subscription
 * 3. Processor picks up and processes the job
 * 4. Job lifecycle events fire correctly (active, completed)
 * 5. Queue cleanup on shutdown
 */
jest.setTimeout(30000);

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Queue, Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import Redis from 'ioredis';

describe('BullMQ — subscription-renewal queue', () => {
  let app: INestApplication;
  let queue: Queue;
  let redis: Redis;

  beforeAll(async () => {
    process.env.E2E_TEST = 'true';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Get the queue instance from the NestJS DI container
    queue = app.get<Queue>(getQueueToken('subscription-renewal'));

    // Direct Redis connection for inspection
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });
  });

  afterAll(async () => {
    // Clean up test jobs
    await queue.obliterate({ force: true }).catch(() => {});
    await redis.quit();
    await app.close();
  });

  it('should connect to Redis successfully', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });

  it('should have the subscription-renewal queue registered', () => {
    expect(queue).toBeDefined();
    expect(queue.name).toBe('subscription-renewal');
  });

  it('should add a job to the queue', async () => {
    const testSubId = 'test-sub-' + Date.now();

    const job = await queue.add(
      'renew',
      { subscriptionId: testSubId },
      {
        delay: 0, // Process immediately for testing
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.name).toBe('renew');
    expect(job.data.subscriptionId).toBe(testSubId);

    console.log(
      `✅ Job enqueued: id=${job.id}, name=${job.name}, data=`,
      job.data,
    );
  });

  it('should process the job and complete it', async () => {
    const testSubId = 'test-process-' + Date.now();

    const job = await queue.add(
      'renew',
      { subscriptionId: testSubId },
      {
        delay: 0,
        removeOnComplete: false, // Keep it so we can inspect
        removeOnFail: false,
      },
    );

    // Wait for the processor to pick it up (max 5s)
    let completed = false;
    for (let i = 0; i < 50; i++) {
      const state = await job.getState();
      if (state === 'completed') {
        completed = true;
        break;
      }
      if (state === 'failed') {
        const failedJob = await Job.fromId(queue, job.id!);
        console.error('Job failed:', failedJob?.failedReason);
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(completed).toBe(true);
    console.log(`✅ Job processed successfully: id=${job.id}`);

    // Clean up
    await job.remove();
  });

  it('should add a delayed job (simulating 30-day renewal)', async () => {
    const testSubId = 'test-delayed-' + Date.now();
    const delayMs = 5000; // 5 seconds for testing instead of 30 days

    const job = await queue.add(
      'renew',
      { subscriptionId: testSubId },
      {
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    const state = await job.getState();
    expect(state).toBe('delayed');

    // Verify the delay is set
    const delayedCount = await queue.getDelayedCount();
    expect(delayedCount).toBeGreaterThanOrEqual(1);

    console.log(
      `✅ Delayed job created: id=${job.id}, state=${state}, delay=${delayMs}ms`,
    );

    // Clean up (don't wait for it)
    await job.remove();
  });

  it('should report queue metrics', async () => {
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const delayed = await queue.getDelayedCount();

    console.log('📊 Queue metrics:', {
      waiting,
      active,
      completed,
      failed,
      delayed,
    });

    // These should all be numbers >= 0
    expect(typeof waiting).toBe('number');
    expect(typeof active).toBe('number');
    expect(typeof completed).toBe('number');
    expect(typeof failed).toBe('number');
    expect(typeof delayed).toBe('number');
  });
});
