import { seedTestUser } from './test-user.seed';
import { Logger } from '@nestjs/common';
import { seedSuperAdmin } from './super-admin.seed';
import { seedPlansAndPermissions } from './plans-permissions.seed';
import { seedSubscriptionAddons } from './subscription-addons.seed';
import { seedLogisticsDemo } from './logistics-demo.seed';
import { seedCrossCompanyDemo } from './cross-company-demo.seed';
import { seedCITestUsers } from './ci-test-users.seed';
import { seedPlansLimits } from './plans-limits.seed';
import { seedPlansV2 } from './plans-v2.seed';

const logger = new Logger('Seed');

async function runSeed() {
  logger.log('🌱 Starting seed...');

  const isCI = process.env.CI === 'true';

  // Planes y permisos mínimos para tests y desarrollo (ALWAYS RUN - required first)
  await seedPlansAndPermissions();
  // Límites de planes por vertical
  await seedPlansLimits();
  // Sprint A — catálogo verticalizado (additivo, no rompe legacy)
  await seedPlansV2();

  // ─── CI/CD path: Create test users directly in PostgreSQL ────
  if (isCI) {
    await seedCITestUsers();
  } else {
    // ─── Development/local path: Create users via Supabase Auth (usa .env.test en local)
    let supabaseFailed = false;
    try {
      await seedSuperAdmin();
    } catch (error) {
      logger.error(
        '❌ Super admin seed failed, will fallback to local seed:',
        error,
      );
      supabaseFailed = true;
    }

    try {
      await seedTestUser();
    } catch (error) {
      logger.error(
        '❌ Test user seed failed, will fallback to local seed:',
        error,
      );
      supabaseFailed = true;
    }

    if (supabaseFailed) {
      logger.warn(
        '⚠️  Fallback: Creating test users directly in DB (CI logic)',
      );
      await seedCITestUsers();
    }
  }

  // Addons de suscripción de ejemplo
  await seedSubscriptionAddons();

  // Datos demo de logística (solo si SEED_DEMO=true)
  try {
    await seedLogisticsDemo();
  } catch (error) {
    if (isCI) {
      logger.warn(
        '⚠️  Skipping logistics demo seed (Supabase not configured in CI/CD)',
      );
    } else {
      throw error;
    }
  }

  // Datos demo cross-empresa (solo si SEED_DEMO=true)
  try {
    await seedCrossCompanyDemo();
  } catch (error) {
    if (isCI) {
      logger.warn(
        '⚠️  Skipping cross-company demo seed (Supabase not configured in CI/CD)',
      );
    } else {
      throw error;
    }
  }

  // TODO: Implement additional seeds in subsequent phases
  // - plans.seed.ts (Sprint 3)
  // - categories.seed.ts (Sprint 10)
  // - demo-data.seed.ts (only if SEED_DEMO=true)

  logger.log('✅ Seed completed');
  process.exit(0);
}

runSeed().catch((error) => {
  logger.error('❌ Seed failed', error);
  process.exit(1);
});
