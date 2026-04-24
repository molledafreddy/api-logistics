import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompaniesTable1700000000004 implements MigrationInterface {
  name = 'CreateCompaniesTable1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Tabla companies ─────────────────────
    await queryRunner.query(`
      CREATE TABLE companies (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        owner_id          UUID,

        -- Información básica
        name              VARCHAR(255) NOT NULL,
        legal_name        VARCHAR(255),
        type              company_type_enum NOT NULL,
        status            company_status_enum NOT NULL DEFAULT 'pending_verification',

        -- Identificadores fiscales / legales
        tax_id            VARCHAR(50),
        mc_number         VARCHAR(20),
        dot_number        VARCHAR(20),
        scac_code         VARCHAR(10),

        -- Contacto
        email             VARCHAR(255),
        phone             VARCHAR(30),
        website           VARCHAR(500),

        -- Dirección
        address_line1     VARCHAR(255),
        address_line2     VARCHAR(255),
        city              VARCHAR(100),
        state             VARCHAR(100),
        zip_code          VARCHAR(20),
        country           VARCHAR(3) DEFAULT 'US',

        -- Branding
        logo_url          VARCHAR(500),

        -- Configuración
        settings          JSONB DEFAULT '{}',
        timezone          VARCHAR(50) DEFAULT 'America/New_York',

        -- Timestamps
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ,

        -- Constraints
        CONSTRAINT uq_companies_tax_id UNIQUE(tax_id),
        CONSTRAINT uq_companies_mc_number UNIQUE(mc_number),
        CONSTRAINT uq_companies_dot_number UNIQUE(dot_number)
      );

      -- Índices
      CREATE INDEX idx_companies_owner ON companies(owner_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_companies_type ON companies(type) WHERE deleted_at IS NULL;
      CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
      CREATE INDEX idx_companies_name_trgm ON companies USING gin(name gin_trgm_ops);

      -- Trigger para updated_at (reutilizar la función ya creada)
      CREATE TRIGGER update_companies_updated_at
        BEFORE UPDATE ON companies
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ─── FK: users.company_id → companies.id ─────────
    await queryRunner.query(`
      ALTER TABLE users
        ADD CONSTRAINT fk_users_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE SET NULL;
    `);

    // ─── FK: companies.owner_id → users.id ─────────
    await queryRunner.query(`
      ALTER TABLE companies
        ADD CONSTRAINT fk_companies_owner
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE companies DROP CONSTRAINT IF EXISTS fk_companies_owner`,
    );
    await queryRunner.query(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_company`,
    );
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
      DROP TABLE IF EXISTS companies;
    `);
  }
}
