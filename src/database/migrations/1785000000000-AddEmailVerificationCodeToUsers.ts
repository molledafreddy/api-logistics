import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Infraestructura de código OTP de 6 dígitos para verificación de email.
 * Backfillea email_verified_at en cuentas existentes (creadas antes de que
 * esta exigencia existiera) para no bloquearlas retroactivamente.
 */
export class AddEmailVerificationCodeToUsers1785000000000 implements MigrationInterface {
  name = 'AddEmailVerificationCodeToUsers1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verification_code_hash varchar(255),
        ADD COLUMN IF NOT EXISTS email_verification_code_expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS email_verification_attempts int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS email_verification_last_sent_at timestamptz;

      UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS email_verification_code_hash,
        DROP COLUMN IF EXISTS email_verification_code_expires_at,
        DROP COLUMN IF EXISTS email_verification_attempts,
        DROP COLUMN IF EXISTS email_verification_last_sent_at;
    `);
  }
}
