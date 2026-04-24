import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 7 · Sprint 7 — Optimización + ETAs
 *
 * Agrega a `delivery_runs` campos para almacenar el resultado de la
 * optimización de la secuencia de stops y el ETA por shipment.
 *
 * - estimated_distance_km : distancia total estimada del run (post-optimización)
 * - optimized_at          : timestamp de la última optimización
 * - optimization_provider : qué motor se usó ('haversine' | 'google_routes' | 'mapbox')
 * - eta_per_stop          : jsonb [{ shipmentId, etaAt, distanceFromPrevKm, durationFromPrevMin }]
 *
 * Idempotente: usa IF NOT EXISTS.
 */
export class AddOptimizationFieldsToDeliveryRuns1708000000005 implements MigrationInterface {
  name = 'AddOptimizationFieldsToDeliveryRuns1708000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE delivery_runs
        ADD COLUMN IF NOT EXISTS optimized_at timestamptz,
        ADD COLUMN IF NOT EXISTS optimization_provider varchar(20),
        ADD COLUMN IF NOT EXISTS eta_per_stop jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE delivery_runs
        DROP COLUMN IF EXISTS optimized_at,
        DROP COLUMN IF EXISTS optimization_provider,
        DROP COLUMN IF EXISTS eta_per_stop;
    `);
  }
}
