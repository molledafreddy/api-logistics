import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanLimitAndVerticalization1714410000000 implements MigrationInterface {
  name = 'AddPlanLimitAndVerticalization1714410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plan_limits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "vertical" character varying(50) NOT NULL,
        "code" character varying(50) NOT NULL,
        "value" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan_limits_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_plan_limits_plan" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_plan_limit_unique" ON "plan_limits" ("plan_id", "vertical", "code");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_plan_limit_unique";
      DROP TABLE IF EXISTS "plan_limits";
    `);
  }
}
