import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlansAndPermissionsTables1702400000001 implements MigrationInterface {
  name = 'CreatePlansAndPermissionsTables1702400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── plans ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(50) NOT NULL UNIQUE,
        description text,
        price numeric(10,2) NOT NULL DEFAULT 0,
        interval varchar(20) NOT NULL DEFAULT 'month',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ─── permission_definitions ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permission_definitions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(100) NOT NULL UNIQUE,
        description text,
        feature varchar(50),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ─── plan_permissions ────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plan_permissions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        permission_id uuid NOT NULL REFERENCES permission_definitions(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(plan_id, permission_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS plan_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS permission_definitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS plans`);
  }
}
