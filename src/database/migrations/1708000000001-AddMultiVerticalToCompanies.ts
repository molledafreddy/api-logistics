import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 7 — Sprint 0 · Foundation Multi-Vertical
 *
 * Agrega soporte para empresas de transporte de personas (passenger) además de
 * carga (freight), y clasifica por tamaño operacional (independent/small_fleet/enterprise).
 *
 * Cambios:
 *   1. Crea ENUMs `service_type_enum` y `business_model_enum`.
 *   2. Agrega columnas `service_type` (default 'freight') y `business_model`
 *      (default 'small_fleet') a `companies`.
 *
 * Compatibilidad: 100% hacia atrás. Defaults seguros. Sin backfill necesario.
 */
export class AddMultiVerticalToCompanies1708000000001 implements MigrationInterface {
  name = 'AddMultiVerticalToCompanies1708000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear ENUMs
    await queryRunner.query(`
      CREATE TYPE service_type_enum AS ENUM ('freight', 'passenger', 'mixed')
    `);
    await queryRunner.query(`
      CREATE TYPE business_model_enum AS ENUM ('independent', 'small_fleet', 'enterprise')
    `);

    // 2. Agregar columnas a companies (defaults seguros → no requiere backfill)
    await queryRunner.query(`
      ALTER TABLE companies
        ADD COLUMN service_type   service_type_enum   NOT NULL DEFAULT 'freight',
        ADD COLUMN business_model business_model_enum NOT NULL DEFAULT 'small_fleet'
    `);

    // 3. Índices útiles para filtrado por vertical (usado en admin analytics)
    await queryRunner.query(`
      CREATE INDEX idx_companies_service_type   ON companies (service_type)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_companies_business_model ON companies (business_model)
    `);

    // 4. Comentarios de documentación
    await queryRunner.query(`
      COMMENT ON COLUMN companies.service_type IS
        'Vertical de servicio: freight (carga) | passenger (personas) | mixed'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN companies.business_model IS
        'Tamaño operacional: independent | small_fleet | enterprise'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_companies_business_model`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_companies_service_type`);
    await queryRunner.query(`
      ALTER TABLE companies
        DROP COLUMN IF EXISTS business_model,
        DROP COLUMN IF EXISTS service_type
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS business_model_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS service_type_enum`);
  }
}
