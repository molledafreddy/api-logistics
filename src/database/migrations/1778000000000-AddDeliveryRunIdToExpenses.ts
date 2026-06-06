import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryRunIdToExpenses1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS delivery_run_id UUID NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_delivery_run_id
      ON expenses (delivery_run_id)
      WHERE delivery_run_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_expenses_delivery_run_id`,
    );
    await queryRunner.query(
      `ALTER TABLE expenses DROP COLUMN IF EXISTS delivery_run_id`,
    );
  }
}
