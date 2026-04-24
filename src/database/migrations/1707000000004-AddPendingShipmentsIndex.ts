import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el índice parcial para listar shipments pendientes por carrier.
 *
 * Está separado de la migración anterior porque PostgreSQL no permite
 * usar un valor de enum recién agregado dentro de la misma transacción
 * en la que fue creado (error 55P04 "unsafe use of new value of enum type").
 */
export class AddPendingShipmentsIndex1707000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_pending_by_carrier
        ON shipments (company_id)
        WHERE status = 'pending_acceptance' AND deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_shipments_pending_by_carrier;`,
    );
  }
}
