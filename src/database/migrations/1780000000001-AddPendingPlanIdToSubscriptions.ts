import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingPlanIdToSubscriptions1780000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS pending_plan_id UUID NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions
      DROP COLUMN IF EXISTS pending_plan_id
    `);
  }
}
