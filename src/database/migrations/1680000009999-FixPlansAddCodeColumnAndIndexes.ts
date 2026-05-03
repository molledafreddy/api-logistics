import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPlansAddCodeColumnAndIndexes1680000009999 implements MigrationInterface {
  name = 'FixPlansAddCodeColumnAndIndexes1680000009999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hotfix histórico para entornos productivos donde la tabla `plans`
    // ya existía antes de `ExtendPlansForVerticalsAndLimits1709000000001`.
    // En BD limpia (CI / dev) esta migración corre ANTES de que la tabla
    // sea creada (timestamp 1680... < 1702...), así que debe ser no-op
    // si la tabla aún no existe. La migración 1709... aplicará las mismas
    // columnas más adelante de forma idempotente.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'plans'
        ) THEN
          ALTER TABLE plans
            ADD COLUMN IF NOT EXISTS code varchar(50),
            ADD COLUMN IF NOT EXISTS audience varchar(20),
            ADD COLUMN IF NOT EXISTS tier varchar(20),
            ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb;

          CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique
            ON plans (code) WHERE code IS NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'plans'
        ) THEN
          DROP INDEX IF EXISTS plans_code_unique;
          ALTER TABLE plans
            DROP COLUMN IF EXISTS limits,
            DROP COLUMN IF EXISTS tier,
            DROP COLUMN IF EXISTS audience,
            DROP COLUMN IF EXISTS code;
        END IF;
      END $$;
    `);
  }
}
