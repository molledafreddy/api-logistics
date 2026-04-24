import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1700000000003 implements MigrationInterface {
  name = 'CreateUsersTable1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        auth_uid        UUID NOT NULL,
        company_id      UUID,

        -- Información personal
        email           VARCHAR(255) NOT NULL,
        phone           VARCHAR(30),
        first_name      VARCHAR(100) NOT NULL,
        last_name       VARCHAR(100) NOT NULL,
        avatar_url      VARCHAR(500),

        -- Rol y estado
        role            user_role_enum NOT NULL DEFAULT 'driver',
        status          user_status_enum NOT NULL DEFAULT 'active',

        -- Configuración
        timezone        VARCHAR(50) DEFAULT 'America/New_York',
        language        VARCHAR(5) DEFAULT 'en',
        settings        JSONB DEFAULT '{}',

        -- Login tracking
        last_login_at   TIMESTAMPTZ,
        last_login_ip   INET,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until    TIMESTAMPTZ,

        -- Email verification
        email_verified_at   TIMESTAMPTZ,

        -- Timestamps
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,

        -- Constraints
        CONSTRAINT uq_users_email UNIQUE(email),
        CONSTRAINT uq_users_auth_uid UNIQUE(auth_uid),
        CONSTRAINT chk_users_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
      );

      -- Índices
      CREATE INDEX idx_users_auth_uid ON users(auth_uid);
      CREATE INDEX idx_users_company ON users(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_users_role ON users(company_id, role) WHERE deleted_at IS NULL;
      CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
      CREATE INDEX idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
      CREATE INDEX idx_users_name_search ON users USING gin(
        (first_name || ' ' || last_name) gin_trgm_ops
      );

      -- Trigger para updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      DROP FUNCTION IF EXISTS update_updated_at_column();
      DROP TABLE IF EXISTS users;
    `);
  }
}
