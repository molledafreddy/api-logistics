import dataSource from '../data-source';

async function run() {
  if (!dataSource.isInitialized) await dataSource.initialize();

  // Cancelar todas las suscripciones que apuntan a planes legacy (is_active = false)
  const result = await dataSource.query(`
    UPDATE subscriptions s
       SET status = 'canceled', canceled_at = NOW()
      FROM plans p
     WHERE s.plan_id = p.id
       AND p.is_active = false
       AND s.status = 'active'
  `);
  console.log(`Suscripciones legacy canceladas:`, result);

  // Verificar estado final
  const rows = await dataSource.query(`
    SELECT s.id, s.status, p.name as plan_name, p.code as plan_code
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    ORDER BY s.created_at DESC
    LIMIT 10
  `);
  console.log('Estado final:', JSON.stringify(rows, null, 2));

  process.exit(0);
}

run().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
