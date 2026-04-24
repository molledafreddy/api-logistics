import dataSource from '../src/database/data-source';

async function main() {
  if (!dataSource.isInitialized) await dataSource.initialize();

  const company = await dataSource.query(
    `SELECT id, name FROM companies WHERE name = $1 LIMIT 1`,
    ['Test Company'],
  );
  const plan = await dataSource.query(
    `SELECT id, name FROM plans WHERE name = $1 LIMIT 1`,
    ['Business'],
  );

  if (company.length > 0) {
    console.log('✅ Empresa encontrada:', company[0]);
  } else {
    console.log('❌ Empresa "Test Company" NO encontrada');
  }

  if (plan.length > 0) {
    console.log('✅ Plan encontrado:', plan[0]);
  } else {
    console.log('❌ Plan "Business" NO encontrado');
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error verificando datos:', err);
  process.exit(1);
});
