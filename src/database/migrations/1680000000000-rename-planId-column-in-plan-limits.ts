import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePlanIdColumnInPlanLimits1680000000000 implements MigrationInterface {
  name = 'RenamePlanIdColumnInPlanLimits1680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sólo renombra si la tabla existe Y la columna "planId" aún existe
    // (en una BD limpia de test la tabla se creará más adelante con el
    //  nombre correcto "plan_id", por lo que este paso es un no-op)
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'plan_limits'
                      AND column_name = 'planId'
                ) THEN
                    ALTER TABLE plan_limits RENAME COLUMN "planId" TO "plan_id";
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
                    WHERE table_name = 'plan_limits'
                      AND column_name = 'plan_id'
                ) THEN
                    ALTER TABLE plan_limits RENAME COLUMN "plan_id" TO "planId";
                END IF;
            END $$;
        `);
  }
}
