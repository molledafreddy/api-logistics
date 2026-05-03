import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPlansAddCodeColumnAndIndexes1680000009999 implements MigrationInterface {
  name = 'FixPlansAddCodeColumnAndIndexes1680000009999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plans
        ADD COLUMN IF NOT EXISTS code varchar(50),
        ADD COLUMN IF NOT EXISTS audience varchar(20),
        ADD COLUMN IF NOT EXISTS tier varchar(20),
        ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique
        ON plans (code) WHERE code IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS plans_code_unique`);
    await queryRunner.query(`
      ALTER TABLE plans
        DROP COLUMN IF EXISTS limits,
        DROP COLUMN IF EXISTS tier,
        DROP COLUMN IF EXISTS audience,
        DROP COLUMN IF EXISTS code
    `);
  }
}
