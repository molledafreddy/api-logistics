import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint C.5 — saved_addresses (favoritos por compañía).
 *
 * Permite a operadores y dispatchers persistir direcciones recurrentes
 * (depots, clientes top, puntos de retiro habituales) para no re-tipear
 * ni re-geocodificar cada vez. Reutiliza el shape de Geocoding (`place_id`,
 * `confidence`) que ya alimenta `shipments.origin_*` / `destination_*`.
 *
 * Diseño:
 *   - Tenancy estricto: `company_id` NOT NULL + FK a `companies`.
 *   - `kind` discrimina depot | customer | dropoff | other (string libre,
 *     el ENUM se evita para no requerir migración cuando aparezcan nuevos).
 *   - Soft delete vía `deleted_at`.
 *   - Índice único parcial `(company_id, label)` mientras `deleted_at IS NULL`
 *     para evitar etiquetas duplicadas en operación.
 *   - Índice geoespacial básico `(company_id, lat, lng)` por si más adelante
 *     se quiere "buscar favoritos cercanos a este punto".
 */
export class CreateSavedAddresses1710000000002 implements MigrationInterface {
  name = 'CreateSavedAddresses1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_addresses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "created_by" uuid NULL,
        "label" varchar(120) NOT NULL,
        "kind" varchar(30) NOT NULL DEFAULT 'other',
        "formatted" varchar(500) NOT NULL,
        "lat" numeric(9,6) NOT NULL,
        "lng" numeric(9,6) NOT NULL,
        "place_id" varchar(200) NULL,
        "confidence" numeric(3,2) NULL,
        "country" varchar(8) NULL,
        "region" varchar(120) NULL,
        "locality" varchar(120) NULL,
        "postcode" varchar(20) NULL,
        "notes" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "fk_saved_addresses_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_saved_addresses_company"
        ON "saved_addresses" ("company_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_saved_addresses_company_kind"
        ON "saved_addresses" ("company_id", "kind") WHERE "deleted_at" IS NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_saved_addresses_company_label"
        ON "saved_addresses" ("company_id", "label") WHERE "deleted_at" IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_saved_addresses_company_geo"
        ON "saved_addresses" ("company_id", "lat", "lng") WHERE "deleted_at" IS NULL;
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "saved_addresses" IS
        'Sprint C.5 — Direcciones favoritas por compañía (depots, clientes, dropoffs).';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "saved_addresses"."kind" IS
        'depot | customer | dropoff | pickup | other (libre, sin ENUM).';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "saved_addresses"."place_id" IS
        'ID estable del provider de geocoding (Mapbox/etc) — opcional.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_saved_addresses_company_geo";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_saved_addresses_company_label";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_saved_addresses_company_kind";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_saved_addresses_company";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_addresses";`);
  }
}
