import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVerificationTables1705000000001 implements MigrationInterface {
  name = 'CreateVerificationTables1705000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── verification_tiers ──────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS verification_tiers (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code                VARCHAR(30) NOT NULL UNIQUE,
        name                VARCHAR(100) NOT NULL,
        description         TEXT,
        price               DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency            VARCHAR(3) DEFAULT 'USD',
        validity_days       INTEGER NOT NULL DEFAULT 365,
        required_documents  JSONB NOT NULL DEFAULT '[]',
        requirements        JSONB DEFAULT '{}',
        display_order       INTEGER DEFAULT 0,
        badge_color         VARCHAR(20),
        badge_icon          VARCHAR(50),
        is_active           BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── verifications ───────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS verifications (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        tier_id             UUID NOT NULL REFERENCES verification_tiers(id),
        status              verification_status_enum NOT NULL DEFAULT 'pending',
        submitted_at        TIMESTAMPTZ,
        assigned_to         UUID REFERENCES users(id),
        assigned_at         TIMESTAMPTZ,
        reviewed_by         UUID REFERENCES users(id),
        reviewed_at         TIMESTAMPTZ,
        approved_at         TIMESTAMPTZ,
        rejected_at         TIMESTAMPTZ,
        rejection_reason    TEXT,
        expires_at          TIMESTAMPTZ,
        amount_paid         DECIMAL(10,2) DEFAULT 0,
        review_notes        TEXT,
        metadata            JSONB DEFAULT '{}',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── verification_documents ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS verification_documents (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        verification_id     UUID NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
        document_type       VARCHAR(50) NOT NULL,
        file_url            VARCHAR(500) NOT NULL,
        file_name           VARCHAR(255),
        file_size           INTEGER,
        mime_type           VARCHAR(100),
        status              VARCHAR(20) DEFAULT 'pending',
        reviewed_by         UUID REFERENCES users(id),
        reviewed_at         TIMESTAMPTZ,
        review_notes        TEXT,
        uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_verif_tiers_active ON verification_tiers(is_active, display_order)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_verifications_company ON verifications(company_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_verif_docs_verification ON verification_documents(verification_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS verification_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS verifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS verification_tiers`);
  }
}
