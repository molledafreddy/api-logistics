import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationFieldsToUsers1700000000005 implements MigrationInterface {
  name = 'AddInvitationFieldsToUsers1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add invitation columns to users table
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN invited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN invitation_token VARCHAR(255) UNIQUE,
        ADD COLUMN invitation_expires_at TIMESTAMPTZ;

      -- Make auth_uid nullable (invited users don't have it until they accept)
      ALTER TABLE users ALTER COLUMN auth_uid DROP NOT NULL;

      -- Index for invitation token lookup
      CREATE INDEX idx_users_invitation_token ON users(invitation_token)
        WHERE invitation_token IS NOT NULL AND status = 'pending_verification';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_invitation_token;
      ALTER TABLE users ALTER COLUMN auth_uid SET NOT NULL;
      ALTER TABLE users
        DROP COLUMN IF EXISTS invitation_expires_at,
        DROP COLUMN IF EXISTS invitation_token,
        DROP COLUMN IF EXISTS invited_by_id;
    `);
  }
}
