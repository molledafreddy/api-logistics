/**
 * Seed Runner — Execute all seeders
 * Usage: npx ts-node src/database/seeds.ts
 */
import dataSource from './data-source';
import { runSeeders } from './seeders';

async function main() {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    await runSeeders(dataSource);

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
