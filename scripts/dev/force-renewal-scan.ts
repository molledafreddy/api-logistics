import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RenewalSchedulerService } from '../src/modules/subscriptions/renewal-scheduler.service';

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const svc = app.get(RenewalSchedulerService);
  const res = await svc.scan();
  console.log('SCAN_RESULT:', JSON.stringify(res));
  // Wait a moment for the worker to pick up the job
  await new Promise((r) => setTimeout(r, 25000));
  await app.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
