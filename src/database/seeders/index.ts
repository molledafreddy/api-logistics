import { DataSource } from 'typeorm';
import { seedVerificationTiers } from './verification-tiers.seeder';
import { seedPlansCode } from './plans-code.seeder';
import { seedPlansLimitsOptimizer } from './plans-limits-optimizer.seeder';

export async function runSeeders(dataSource: DataSource): Promise<void> {
  console.log('\n🌱 Running seeders...\n');

  try {
    await seedVerificationTiers(dataSource);
    await seedPlansCode(dataSource);
    await seedPlansLimitsOptimizer(dataSource);
    console.log('\n✅ Seeders completed successfully!\n');
  } catch (error) {
    console.error('❌ Seeder error:', error);
    throw error;
  }
}
