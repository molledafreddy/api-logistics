import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRunAssignedAndProximityAlertNotificationTypes1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction.
    // Commit TypeORM's implicit transaction, add the values, then reopen.
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'run_assigned'`,
    );
    await queryRunner.query(
      `ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'proximity_alert'`,
    );
    await queryRunner.query('BEGIN');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values without recreating the type.
  }
}
