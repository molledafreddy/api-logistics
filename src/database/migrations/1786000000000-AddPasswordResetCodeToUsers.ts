import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Infraestructura de código OTP de 6 dígitos para recuperación de contraseña,
 * en el mismo patrón que AddEmailVerificationCodeToUsers1785000000000.
 */
export class AddPasswordResetCodeToUsers1786000000000 implements MigrationInterface {
  name = 'AddPasswordResetCodeToUsers1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_code_hash varchar(255),
        ADD COLUMN IF NOT EXISTS password_reset_code_expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS password_reset_attempts int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS password_reset_last_sent_at timestamptz;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS password_reset_code_hash,
        DROP COLUMN IF EXISTS password_reset_code_expires_at,
        DROP COLUMN IF EXISTS password_reset_attempts,
        DROP COLUMN IF EXISTS password_reset_last_sent_at;
    `);
  }
}
