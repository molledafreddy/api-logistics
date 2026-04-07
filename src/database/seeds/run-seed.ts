import { Logger } from '@nestjs/common';

const logger = new Logger('Seed');

async function runSeed() {
  logger.log('🌱 Starting seed...');

  // TODO: Implement seeds in subsequent phases
  // - plans.seed.ts
  // - admin.seed.ts
  // - categories.seed.ts
  // - demo-data.seed.ts (only if SEED_DEMO=true)

  logger.log('✅ Seed completed');
  process.exit(0);
}

runSeed().catch((error) => {
  logger.error('❌ Seed failed', error);
  process.exit(1);
});
