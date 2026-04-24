import { DataSource } from 'typeorm';
import { seedVerificationTiers } from './verification-tiers.seeder';

export async function runSeeders(dataSource: DataSource): Promise<void> {
  console.log('\n🌱 Running seeders...\n');

  try {
    await seedVerificationTiers(dataSource);
    console.log('\n✅ Seeders completed successfully!\n');
  } catch (error) {
    console.error('❌ Seeder error:', error);
    throw error;
  }
}
