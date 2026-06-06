import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReferralsTables1779000000001 implements MigrationInterface {
  name = 'CreateReferralsTables1779000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── referral_config ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_config" (
        "id"                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "referrer_discount_pct" integer     NOT NULL DEFAULT 20,
        "referred_discount_pct" integer     NOT NULL DEFAULT 30,
        "link_ttl_hours"        integer     NOT NULL DEFAULT 72,
        "is_active"             boolean     NOT NULL DEFAULT true,
        "updated_by"            uuid,
        "updated_at"            timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_referral_config" PRIMARY KEY ("id")
      )
    `);

    // Fila única de configuración global
    await queryRunner.query(`
      INSERT INTO "referral_config"
        ("referrer_discount_pct", "referred_discount_pct", "link_ttl_hours", "is_active")
      VALUES (20, 30, 72, true)
      ON CONFLICT DO NOTHING
    `);

    // ─── referral_links ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_links" (
        "id"          uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "company_id"  uuid        NOT NULL,
        "token"       varchar(64) NOT NULL,
        "expires_at"  timestamptz NOT NULL,
        "max_uses"    integer     NOT NULL DEFAULT 1,
        "times_used"  integer     NOT NULL DEFAULT 0,
        "is_active"   boolean     NOT NULL DEFAULT true,
        "created_by"  uuid        NOT NULL,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_referral_links" PRIMARY KEY ("id"),
        CONSTRAINT "uq_referral_links_token" UNIQUE ("token")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_referral_links_company_id"
        ON "referral_links" ("company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_referral_links_token"
        ON "referral_links" ("token")
        WHERE "is_active" = true
    `);

    // ─── referrals ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referrals" (
        "id"                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "referral_link_id"      uuid        NOT NULL,
        "referrer_company_id"   uuid        NOT NULL,
        "referred_company_id"   uuid        NOT NULL,
        "status"                varchar(32) NOT NULL DEFAULT 'pending',
        "referrer_discount_pct" integer     NOT NULL,
        "referred_discount_pct" integer     NOT NULL,
        "referred_rewarded_at"  timestamptz,
        "referrer_rewarded_at"  timestamptz,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_referrals" PRIMARY KEY ("id"),
        CONSTRAINT "uq_referrals_referred_company"
          UNIQUE ("referred_company_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_referrals_referrer_company_id"
        ON "referrals" ("referrer_company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_referrals_status"
        ON "referrals" ("status")
    `);

    // ─── subscriptions: columnas de descuento por referido ──────────
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "pending_referral_discount_pct" integer,
        ADD COLUMN IF NOT EXISTS "referral_discount_applied_at"  timestamptz
    `);

    // ─── companies: columna de empresa referidora ────────────────────
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "referred_by_company_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_companies_referred_by"
        ON "companies" ("referred_by_company_id")
        WHERE "referred_by_company_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_companies_referred_by"`);
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN IF EXISTS "referred_by_company_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "referral_discount_applied_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "pending_referral_discount_pct"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_referrals_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_referrals_referrer_company_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "referrals"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_referral_links_token"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_referral_links_company_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_links"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "referral_config"`);
  }
}
