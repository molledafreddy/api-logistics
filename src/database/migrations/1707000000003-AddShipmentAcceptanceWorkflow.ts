import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Workflow de aceptación de envíos cross-empresa.
 *
 * Cambios:
 *  1. Agrega valor 'pending_acceptance' al enum shipment_status_enum
 *  2. Agrega valores nuevos a notification_type_enum (proposed/accepted/rejected/cancelled)
 *  3. Agrega columnas en shipments:
 *      - proposed_by / proposed_at  (quién y cuándo propuso un cross-company shipment)
 *      - accepted_by / accepted_at  (carrier que aceptó)
 *      - rejected_by / rejected_at / rejection_reason
 */
export class AddShipmentAcceptanceWorkflow1707000000003 implements MigrationInterface {
  // Esta migración necesita auto-commit por valor (no transacción)
  // porque PostgreSQL no permite usar valores nuevos de un enum dentro
  // de la misma transacción donde se crearon. La transacción se controla
  // a nivel de data-source con migrationsTransactionMode: 'each'; aquí
  // adicionalmente la deshabilitamos por seguridad.
  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Enum shipment_status: agregar pending_acceptance ───
    await queryRunner.query(`
      ALTER TYPE shipment_status_enum ADD VALUE IF NOT EXISTS 'pending_acceptance' BEFORE 'draft';
    `);

    // ─── 2. Enum notification_type: agregar nuevos tipos ───
    // (PostgreSQL no permite ADD VALUE en transacción; usamos DO block con IF NOT EXISTS)
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'shipment_proposed';
    `);
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'shipment_accepted';
    `);
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'shipment_rejected';
    `);
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'shipment_cancelled';
    `);

    // ─── 3. Columnas nuevas en shipments ───
    await queryRunner.query(`
      ALTER TABLE shipments
        ADD COLUMN IF NOT EXISTS proposed_by       UUID,
        ADD COLUMN IF NOT EXISTS proposed_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS accepted_by       UUID,
        ADD COLUMN IF NOT EXISTS accepted_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejected_by       UUID,
        ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
    `);

    // Nota: el índice parcial WHERE status = 'pending_acceptance' se crea
    // en la siguiente migración porque PostgreSQL exige commit del nuevo
    // valor del enum antes de poder usarlo en una expresión de índice.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shipments
        DROP COLUMN IF EXISTS proposed_by,
        DROP COLUMN IF EXISTS proposed_at,
        DROP COLUMN IF EXISTS accepted_by,
        DROP COLUMN IF EXISTS accepted_at,
        DROP COLUMN IF EXISTS rejected_by,
        DROP COLUMN IF EXISTS rejected_at,
        DROP COLUMN IF EXISTS rejection_reason;
    `);
    // Nota: no se puede DROP VALUE de un enum en PostgreSQL.
    // Los valores 'pending_acceptance' y notification_type_enum nuevos quedarán huérfanos.
  }
}
