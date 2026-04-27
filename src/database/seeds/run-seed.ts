import { seedTestUser } from './test-user.seed';
import { Logger } from '@nestjs/common';
import { seedSuperAdmin } from './super-admin.seed';
import { seedPlansAndPermissions } from './plans-permissions.seed';
import { seedSubscriptionAddons } from './subscription-addons.seed';
import { seedLogisticsDemo } from './logistics-demo.seed';
import { seedCrossCompanyDemo } from './cross-company-demo.seed';

const logger = new Logger('Seed');

async function runSeed() {
  logger.log('🌱 Starting seed...');

  const isCI = process.env.NODE_ENV === 'test' && process.env.CI === 'true';

  // Super admin user (skip in CI/CD if Supabase credentials missing)
  try {
    await seedSuperAdmin();
  } catch (error) {
    if (isCI) {
      logger.warn(
        '⚠️  Skipping super admin seed (Supabase not configured in CI/CD)',
      );
    } else {
      throw error;
    }
  }

  // Planes y permisos mínimos para tests y desarrollo
  await seedPlansAndPermissions();

  // Usuario de pruebas asociado a plan Business (skip in CI/CD)
  try {
    await seedTestUser();
  } catch (error) {
    if (isCI) {
      logger.warn(
        '⚠️  Skipping test user seed (Supabase not configured in CI/CD)',
      );
    } else {
      throw error;
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
