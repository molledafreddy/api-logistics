import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHiddenByToConversationsAndCreatedByToShipments1781000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_conversations
      ADD COLUMN IF NOT EXISTS hidden_by JSONB NOT NULL DEFAULT '[]'
    `);

    await queryRunner.query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS created_by UUID NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE shipments DROP COLUMN IF EXISTS created_by`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_conversations DROP COLUMN IF EXISTS hidden_by`,
    );
  }
}
