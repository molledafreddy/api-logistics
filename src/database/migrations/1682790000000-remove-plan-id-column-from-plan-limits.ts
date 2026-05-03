import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePlanIdColumnFromPlanLimits1682790000000 implements MigrationInterface {
  name = 'RemovePlanIdColumnFromPlanLimits1682790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sólo ejecuta si la tabla y la columna existen (no-op en BD limpia)
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'plan_limits'
                      AND column_name = 'plan_id'
                ) AND EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'plan_limits'
                      AND column_name = 'planId'
                ) THEN
                    -- Sólo tiene sentido borrar plan_id si ya existe planId
                    -- (estado intermedio de producción después de rename)
                    ALTER TABLE "plan_limits" DROP COLUMN "plan_id";
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_limits') THEN
                    ALTER TABLE "plan_limits" ADD COLUMN IF NOT EXISTS "plan_id" uuid;
                END IF;
            END $$;
        `);
  }
}
