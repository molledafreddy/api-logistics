import dataSource from '../data-source';

async function run() {
  if (!dataSource.isInitialized) await dataSource.initialize();

  const rows = await dataSource.query(`
    SELECT s.id, s.status, s.created_at, p.name as plan_name, p.code as plan_code, p.is_active
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    ORDER BY s.created_at DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

run().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
