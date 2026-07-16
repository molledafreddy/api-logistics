import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite crear conductores independientes sin número de licencia (campo
 * opcional en el onboarding de mobile). El índice único parcial
 * uq_drivers_company_license (company_id, license_number WHERE deleted_at
 * IS NULL) no se ve afectado: Postgres no considera los NULL como iguales
 * entre sí, así que múltiples drivers sin licencia en la misma empresa
 * no colisionan.
 */
export class MakeDriverLicenseNumberNullable1784000000000 implements MigrationInterface {
  name = 'MakeDriverLicenseNumberNullable1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'drivers'
            AND column_name  = 'license_number'
            AND is_nullable  = 'NO'
        ) THEN
          ALTER TABLE drivers
            ALTER COLUMN license_number DROP NOT NULL;
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
            AND table_name   = 'drivers'
            AND column_name  = 'license_number'
            AND is_nullable  = 'YES'
        ) THEN
          IF NOT EXISTS (SELECT 1 FROM drivers WHERE license_number IS NULL) THEN
            ALTER TABLE drivers
              ALTER COLUMN license_number SET NOT NULL;
          END IF;
        END IF;
      END $$;
    `);
  }
}
