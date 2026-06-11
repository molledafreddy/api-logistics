import dataSource from './data-source';

async function runMigrations(): Promise<void> {
  await dataSource.initialize();
  const migrations = await dataSource.runMigrations();
  console.log(`Ran ${migrations.length} migration(s)`);
  await dataSource.destroy();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
