import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint F.1 — Auto-cobro recurrente.
 *
 * Añade a `subscriptions`:
 *   - grace_period_until         → ventana de gracia tras un pago fallido
 *   - last_renewal_attempt_at    → último intento del scan de renovación
 *   - last_renewal_init_point    → URL del checkout pendiente (para re-uso del frontend)
 *
 * Idempotente vía DO $$ IF EXISTS table $$.
 */
export class AddRenewalFieldsToSubscriptions1715000000002 implements MigrationInterface {
  name = 'AddRenewalFieldsToSubscriptions1715000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions'
        ) THEN
          ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS grace_period_until      timestamptz,
            ADD COLUMN IF NOT EXISTS last_renewal_attempt_at timestamptz,
            ADD COLUMN IF NOT EXISTS last_renewal_init_point varchar(500);

          -- Índice para escaneo eficiente de renovaciones próximas a vencer
          CREATE INDEX IF NOT EXISTS subscriptions_renewal_scan_idx
            ON subscriptions (status, current_period_end)
            WHERE status IN ('active', 'pending_payment');
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions'
        ) THEN
          DROP INDEX IF EXISTS subscriptions_renewal_scan_idx;
          ALTER TABLE subscriptions
            DROP COLUMN IF EXISTS last_renewal_init_point,
            DROP COLUMN IF EXISTS last_renewal_attempt_at,
            DROP COLUMN IF EXISTS grace_period_until;
        END IF;
      END $$;
    `);
  }
}
