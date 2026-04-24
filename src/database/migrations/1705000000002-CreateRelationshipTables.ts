import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRelationshipTables1705000000002 implements MigrationInterface {
  name = 'CreateRelationshipTables1705000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enum for relationship_type ──────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE relationship_type_enum AS ENUM ('covered_carrier', 'associated_company', 'client_carrier');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ─── company_relationships ───────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_relationships (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        parent_company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        child_company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        relationship_type     relationship_type_enum NOT NULL,
        status                relationship_status_enum NOT NULL DEFAULT 'pending',
        invited_by            UUID REFERENCES users(id),
        invitation_email      VARCHAR(255),
        invitation_token      VARCHAR(255) UNIQUE,
        invitation_message    TEXT,
        invited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        responded_by          UUID REFERENCES users(id),
        accepted_at           TIMESTAMPTZ,
        rejected_at           TIMESTAMPTZ,
        rejection_reason      TEXT,
        suspended_at          TIMESTAMPTZ,
        suspended_reason      TEXT,
        terminated_at         TIMESTAMPTZ,
        terminated_reason     TEXT,
        terminated_by         UUID REFERENCES users(id),
        config                JSONB DEFAULT '{}',
        notes                 TEXT,
        metadata              JSONB DEFAULT '{}',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_no_self_relationship CHECK (parent_company_id != child_company_id),
        CONSTRAINT uq_company_relationship UNIQUE(parent_company_id, child_company_id, relationship_type)
      )
    `);

    // ─── company_relationship_logs ───────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_relationship_logs (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        relationship_id       UUID NOT NULL REFERENCES company_relationships(id) ON DELETE CASCADE,
        action                VARCHAR(50) NOT NULL,
        from_status           relationship_status_enum,
        to_status             relationship_status_enum NOT NULL,
        performed_by          UUID REFERENCES users(id),
        reason                TEXT,
        metadata              JSONB DEFAULT '{}',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_comp_rel_parent ON company_relationships(parent_company_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_comp_rel_child ON company_relationships(child_company_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_comp_rel_type ON company_relationships(relationship_type, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_comp_rel_logs_rel ON company_relationship_logs(relationship_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS company_relationship_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS company_relationships`);
    await queryRunner.query(`DROP TYPE IF EXISTS relationship_type_enum`);
  }
}
