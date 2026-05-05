import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint F.2 — Notificaciones billing + estado `suspended`.
 *
 * Añade a `subscriptions`:
 *   - suspended_at            → momento en que la sub pasó a `suspended`
 *                               (gracia agotada sin pago).
 *   - reactivated_at          → momento del último pago aprobado tras estar
 *                               en `pending_payment` o `suspended`.
 *   - grace_warning_sent_at   → flag idempotente para no duplicar la
 *                               notificación "tu gracia vence mañana".
 *
 * Recrea el índice de scan para incluir `suspended` (también requiere
 * encolarse para reactivación inmediata cuando llega un pago tardío).
 */
export class AddSuspendedFieldsToSubscriptions1715100000000 implements MigrationInterface {
  name = 'AddSuspendedFieldsToSubscriptions1715100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions'
        ) THEN
          ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS suspended_at          timestamptz,
            ADD COLUMN IF NOT EXISTS reactivated_at        timestamptz,
            ADD COLUMN IF NOT EXISTS grace_warning_sent_at timestamptz;

          DROP INDEX IF EXISTS subscriptions_renewal_scan_idx;
          CREATE INDEX IF NOT EXISTS subscriptions_renewal_scan_idx
            ON subscriptions (status, current_period_end)
            WHERE status IN ('active', 'pending_payment', 'suspended');

          CREATE INDEX IF NOT EXISTS subscriptions_suspended_idx
            ON subscriptions (suspended_at)
            WHERE status = 'suspended';
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
          DROP INDEX IF EXISTS subscriptions_suspended_idx;
          DROP INDEX IF EXISTS subscriptions_renewal_scan_idx;
          CREATE INDEX IF NOT EXISTS subscriptions_renewal_scan_idx
            ON subscriptions (status, current_period_end)
            WHERE status IN ('active', 'pending_payment');

          ALTER TABLE subscriptions
            DROP COLUMN IF EXISTS grace_warning_sent_at,
            DROP COLUMN IF EXISTS reactivated_at,
            DROP COLUMN IF EXISTS suspended_at;
        END IF;
      END $$;
    `);
  }
}
