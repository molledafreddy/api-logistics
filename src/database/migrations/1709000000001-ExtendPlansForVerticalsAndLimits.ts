import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint A — Extiende `plans` para soportar:
 *   - `code`     : slug estable usado por la lógica (no acoplarse a `name`).
 *   - `audience` : 'courier' | 'fleet' | 'passenger' | 'any'.
 *   - `tier`     : 'free' | 'pro' | 'enterprise'.
 *   - `limits`   : límites cuantitativos (jsonb) p.ej. maxShipmentsPerDay.
 *
 * Migración 100% aditiva, no rompe planes legacy. Backfill de los planes
 * existentes (Free/Basic/Business/Enterprise) con codes `*_legacy` y
 * audience/tier inferidos.
 */
export class ExtendPlansForVerticalsAndLimits1709000000001 implements MigrationInterface {
  name = 'ExtendPlansForVerticalsAndLimits1709000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Columnas nuevas (todas nullable / con default) ────────────
    await queryRunner.query(`
      ALTER TABLE plans
        ADD COLUMN IF NOT EXISTS code      varchar(50),
        ADD COLUMN IF NOT EXISTS audience  varchar(20),
        ADD COLUMN IF NOT EXISTS tier      varchar(20),
        ADD COLUMN IF NOT EXISTS limits    jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    // Unique parcial para code (permite múltiples NULL durante migración)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique
        ON plans (code) WHERE code IS NOT NULL
    `);

    // ─── Backfill de planes legacy ─────────────────────────────────
    // Se mapean por nombre exacto. Si no existen, no pasa nada.
    await queryRunner.query(`
      UPDATE plans
         SET code = 'free_legacy', audience = 'any', tier = 'free'
       WHERE LOWER(name) = 'free' AND code IS NULL
    `);
    await queryRunner.query(`
      UPDATE plans
         SET code = 'basic_legacy', audience = 'any', tier = 'free'
       WHERE LOWER(name) = 'basic' AND code IS NULL
    `);
    await queryRunner.query(`
      UPDATE plans
         SET code = 'business_legacy', audience = 'fleet', tier = 'pro'
       WHERE LOWER(name) = 'business' AND code IS NULL
    `);
    await queryRunner.query(`
      UPDATE plans
         SET code = 'enterprise_legacy', audience = 'fleet', tier = 'enterprise'
       WHERE LOWER(name) = 'enterprise' AND code IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS plans_code_unique`);
    await queryRunner.query(`
      ALTER TABLE plans
        DROP COLUMN IF EXISTS limits,
        DROP COLUMN IF EXISTS tier,
        DROP COLUMN IF EXISTS audience,
        DROP COLUMN IF EXISTS code
    `);
  }
}
