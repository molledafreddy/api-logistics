import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint E — Permite eventos huérfanos en payment_events (subscription_id NULL).
 *
 * Motivo: webhooks de MercadoPago pueden llegar sin un `external_reference`
 * matching (test events, payments fuera de flujo, errores), pero queremos
 * persistirlos para auditoría e idempotencia. Antes la columna era NOT NULL.
 *
 * Idempotente vía DO $$ IF EXISTS table $$ + condicional sobre is_nullable.
 */
export class MakePaymentEventSubscriptionNullable1715000000001 implements MigrationInterface {
  name = 'MakePaymentEventSubscriptionNullable1715000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'payment_events'
            AND column_name  = 'subscription_id'
            AND is_nullable  = 'NO'
        ) THEN
          ALTER TABLE payment_events
            ALTER COLUMN subscription_id DROP NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'payment_events'
            AND column_name  = 'subscription_id'
            AND is_nullable  = 'YES'
        ) THEN
          -- Sólo si no hay filas con NULL podemos volver a NOT NULL
          IF NOT EXISTS (SELECT 1 FROM payment_events WHERE subscription_id IS NULL) THEN
            ALTER TABLE payment_events
              ALTER COLUMN subscription_id SET NOT NULL;
          END IF;
        END IF;
      END $$;
    `);
  }
}
