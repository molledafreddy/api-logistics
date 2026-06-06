import { Logger } from '@nestjs/common';
import { seedPlansV2 } from './plans-v2.seed';

const logger = new Logger('PlansSeedRunner');

async function run() {
  logger.log('🌱 Ejecutando seed de planes v2...');
  await seedPlansV2();
  logger.log('✅ Seed de planes completado');
  process.exit(0);
}

run().catch((err) => {
  logger.error('❌ Seed de planes falló', err);
  process.exit(1);
});
