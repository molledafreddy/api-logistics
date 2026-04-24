import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Garantiza a nivel de base de datos que un mismo driver no pueda
 * estar asignado activamente a más de un truck dentro de la misma empresa.
 *
 * Reglas:
 *  - Solo aplica cuando current_driver_id IS NOT NULL
 *  - Solo aplica cuando deleted_at IS NULL (los soft-deleted no cuentan)
 *  - El alcance es por company_id (cada tenant es independiente)
 *
 * Esta restricción complementa la validación a nivel de aplicación en
 * TrucksService.assignDriver() y .create(), blindando contra condiciones
 * de carrera (dos requests concurrentes intentando asignar el mismo driver).
 */
export class AddUniqueActiveDriverIndex1707000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_trucks_active_driver
        ON trucks (company_id, current_driver_id)
        WHERE current_driver_id IS NOT NULL
          AND deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_trucks_active_driver;`);
  }
}
