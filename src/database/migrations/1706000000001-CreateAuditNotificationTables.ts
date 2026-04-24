import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditNotificationTables1706000000001 implements MigrationInterface {
  name = 'CreateAuditNotificationTables1706000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enum for notification_type ──────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE notification_type_enum AS ENUM (
          'shipment_status', 'message_new', 'proposal_received',
          'expense_approved', 'verification_update', 'subscription_alert',
          'driver_location', 'system'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ─── audit_logs (partitioned by month) ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id              UUID DEFAULT uuid_generate_v4(),
        company_id      UUID,
        user_id         UUID,
        action          VARCHAR(50) NOT NULL,
        entity_type     VARCHAR(50) NOT NULL,
        entity_id       UUID,
        old_values      JSONB,
        new_values      JSONB,
        ip_address      INET,
        user_agent      TEXT,
        request_id      VARCHAR(100),
        metadata        JSONB DEFAULT '{}',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at)
    `);

    // Partitions for current and next months
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const suffix = `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
      const from = d.toISOString().split('T')[0];
      const to = next.toISOString().split('T')[0];
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS audit_logs_${suffix}
        PARTITION OF audit_logs FOR VALUES FROM ('${from}') TO ('${to}')
      `);
    }

    // ─── notifications ───────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type            notification_type_enum NOT NULL,
        title           VARCHAR(255) NOT NULL,
        body            TEXT,
        resource_type   VARCHAR(50),
        resource_id     UUID,
        action_url      VARCHAR(500),
        data            JSONB DEFAULT '{}',
        read_at         TIMESTAMPTZ,
        dismissed_at    TIMESTAMPTZ,
        push_sent       BOOLEAN DEFAULT FALSE,
        push_sent_at    TIMESTAMPTZ,
        push_error      TEXT,
        email_sent      BOOLEAN DEFAULT FALSE,
        email_sent_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── push_tokens ─────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token           VARCHAR(500) NOT NULL UNIQUE,
        platform        VARCHAR(20) NOT NULL,
        device_name     VARCHAR(100),
        is_active       BOOLEAN DEFAULT TRUE,
        last_used_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id) WHERE is_active = TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS push_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_type_enum`);
  }
}
