import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class AddPublicTrackingToShipments1710000000020 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE shipments
        ADD COLUMN IF NOT EXISTS public_tracking_token UUID UNIQUE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS proximity_alert_sent_at TIMESTAMPTZ DEFAULT NULL;
    `);

    // Backfill token for existing shipments
    await runner.query(`
      UPDATE shipments
      SET public_tracking_token = gen_random_uuid()
      WHERE public_tracking_token IS NULL;
    `);

    await runner.query(`
      ALTER TABLE shipments
        ALTER COLUMN public_tracking_token SET NOT NULL;
    `);

    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_public_tracking_token
        ON shipments (public_tracking_token);
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `DROP INDEX IF EXISTS idx_shipments_public_tracking_token;`,
    );
    await runner.query(`
      ALTER TABLE shipments
        DROP COLUMN IF EXISTS public_tracking_token,
        DROP COLUMN IF EXISTS proximity_alert_sent_at;
    `);
  }
}
