import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint E — Añade campos para integración con proveedor de pagos
 * (MercadoPago Chile en la primera iteración).
 *
 * - `provider`                : 'free' | 'mercadopago' (futuro: 'stripe', etc.).
 * - `provider_subscription_id`: id de preapproval/subscription del provider.
 * - `external_reference`      : token de idempotencia que pasamos al checkout
 *                               y devuelve el webhook (UNIQUE para evitar dobles
 *                               creaciones).
 *
 * Migración 100 % aditiva, idempotente. Defaults seguros para subs Free legacy.
 */
export class AddPaymentProviderToSubscriptions1715000000000 implements MigrationInterface {
  name = 'AddPaymentProviderToSubscriptions1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions'
        ) THEN
          ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS provider varchar(20) NOT NULL DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS provider_subscription_id varchar(120),
            ADD COLUMN IF NOT EXISTS external_reference varchar(80);

          CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_external_ref_unique
            ON subscriptions (external_reference)
            WHERE external_reference IS NOT NULL;

          CREATE INDEX IF NOT EXISTS subscriptions_provider_sub_id_idx
            ON subscriptions (provider_subscription_id)
            WHERE provider_subscription_id IS NOT NULL;
        END IF;
      END $$;
    `);

    // payment_events — añadir external_id (id del payment del provider) para idempotencia
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'payment_events'
        ) THEN
          ALTER TABLE payment_events
            ADD COLUMN IF NOT EXISTS provider varchar(20),
            ADD COLUMN IF NOT EXISTS external_id varchar(120);

          CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_external_unique
            ON payment_events (provider, external_id)
            WHERE external_id IS NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS payment_events_provider_external_unique;
      DROP INDEX IF EXISTS subscriptions_provider_sub_id_idx;
      DROP INDEX IF EXISTS subscriptions_external_ref_unique;

      ALTER TABLE IF EXISTS payment_events
        DROP COLUMN IF EXISTS external_id,
        DROP COLUMN IF EXISTS provider;

      ALTER TABLE IF EXISTS subscriptions
        DROP COLUMN IF EXISTS external_reference,
        DROP COLUMN IF EXISTS provider_subscription_id,
        DROP COLUMN IF EXISTS provider;
    `);
  }
}
