/**
 * Sprint G — Migración de estados legacy.
 *
 * Antes de Sprint F.2 las suscripciones cuyo `grace_period_until` expiraba
 * se marcaban como `canceled`. A partir de F.2 ese estado pasa a
 * `suspended` (más reactivable y con semántica distinta de `canceled`,
 * que ahora se reserva para refunds o cancelación explícita del owner).
 *
 * Este script convierte filas `canceled` con `grace_period_until` no nulo
 * y `suspended_at IS NULL` a `suspended`, fijando `suspended_at = canceled_at`.
 *
 * Uso (dry-run por defecto):
 *   pnpm ts-node scripts/migrate-canceled-to-suspended.ts
 *   pnpm ts-node scripts/migrate-canceled-to-suspended.ts --apply
 */
import dataSource from '../src/database/data-source';

interface Row {
  id: string;
  company_id: string;
  status: string;
  canceled_at: Date | null;
  grace_period_until: Date | null;
  suspended_at: Date | null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  if (!dataSource.isInitialized) await dataSource.initialize();

  const candidates = await dataSource.query(
    `SELECT id, company_id, status, canceled_at, grace_period_until, suspended_at
       FROM subscriptions
      WHERE status = 'canceled'
        AND grace_period_until IS NOT NULL
        AND suspended_at IS NULL`,
  );

  if (candidates.length === 0) {
    console.log('✅ No hay suscripciones canceled con gracia para migrar.');
    await dataSource.destroy();
    return;
  }

  console.log(
    `🔎 Candidatas (${candidates.length}) — modo ${apply ? 'APPLY' : 'DRY-RUN'}:`,
  );
  for (const r of candidates) {
    console.log(
      `   sub=${r.id} company=${r.company_id} canceled_at=${r.canceled_at?.toISOString() ?? 'null'} grace=${r.grace_period_until?.toISOString() ?? 'null'}`,
    );
  }

  if (!apply) {
    console.log('\nℹ️  Re-ejecuta con --apply para confirmar la migración.');
    await dataSource.destroy();
    return;
  }

  const result = await dataSource.query(
    `UPDATE subscriptions
        SET status = 'suspended',
            suspended_at = COALESCE(canceled_at, NOW()),
            updated_at = NOW()
      WHERE status = 'canceled'
        AND grace_period_until IS NOT NULL
        AND suspended_at IS NULL`,
  );
  // pg-driver returns [rows, count]
  const affected = Array.isArray(result) ? result[1] : result;
  console.log(`✅ Migradas ${affected} suscripciones a status='suspended'.`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
