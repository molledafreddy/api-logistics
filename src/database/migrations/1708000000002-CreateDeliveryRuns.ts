import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 7 — Sprint 1 · DeliveryRun
 *
 * Crea la tabla `delivery_runs` (manifiesto operativo del día) y agrega 3
 * columnas opcionales a `shipments` para enlazarlos a un run con secuencia y
 * ETA por parada.
 *
 * Compatibilidad: 100% hacia atrás. Las nuevas columnas en `shipments` son
 * NULLables. Shipments existentes quedan con `delivery_run_id = NULL` y
 * siguen funcionando como hasta ahora.
 */
export class CreateDeliveryRuns1708000000002 implements MigrationInterface {
  name = 'CreateDeliveryRuns1708000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. ENUM de estados del run
    await queryRunner.query(`
      CREATE TYPE delivery_run_status_enum AS ENUM
        ('planned', 'ready', 'in_progress', 'completed', 'cancelled')
    `);

    // 2. Tabla delivery_runs
    await queryRunner.query(`
      CREATE TABLE delivery_runs (
        id                       UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id               UUID                     NOT NULL,
        name                     VARCHAR(150)             NOT NULL,
        scheduled_date           DATE                     NOT NULL,
        shift                    VARCHAR(20)              NOT NULL DEFAULT 'morning',
        start_time               TIME                     NULL,
        driver_id                UUID                     NULL,
        truck_id                 UUID                     NULL,
        route_id                 UUID                     NULL,
        status                   delivery_run_status_enum NOT NULL DEFAULT 'planned',
        total_stops              INTEGER                  NOT NULL DEFAULT 0,
        completed_stops          INTEGER                  NOT NULL DEFAULT 0,
        estimated_distance_km    NUMERIC(10,2)            NULL,
        estimated_duration_min   INTEGER                  NULL,
        optimized_sequence       JSONB                    NOT NULL DEFAULT '[]',
        started_at               TIMESTAMPTZ              NULL,
        finished_at              TIMESTAMPTZ              NULL,
        cancelled_at             TIMESTAMPTZ              NULL,
        cancel_reason            TEXT                     NULL,
        recurring_template_id    UUID                     NULL,
        metadata                 JSONB                    NOT NULL DEFAULT '{}',
        created_at               TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ              NULL
      )
    `);

    // 3. Índices delivery_runs
    await queryRunner.query(`
      CREATE INDEX idx_delivery_runs_company        ON delivery_runs (company_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_delivery_runs_company_date   ON delivery_runs (company_id, scheduled_date)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_delivery_runs_driver         ON delivery_runs (driver_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_delivery_runs_driver_date    ON delivery_runs (driver_id, scheduled_date)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_delivery_runs_status         ON delivery_runs (status)
        WHERE deleted_at IS NULL
    `);

    // 4. Columnas nuevas en shipments
    await queryRunner.query(`
      ALTER TABLE shipments
        ADD COLUMN delivery_run_id UUID         NULL,
        ADD COLUMN run_sequence    INTEGER      NULL,
        ADD COLUMN eta             TIMESTAMPTZ  NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shipments_delivery_run  ON shipments (delivery_run_id)
        WHERE delivery_run_id IS NOT NULL
    `);

    // 5. Comentarios para documentación inline en BD
    await queryRunner.query(`
      COMMENT ON COLUMN shipments.delivery_run_id IS
        'PARTE 7 · Sprint 1 — DeliveryRun al que pertenece este shipment (null si no agrupado)'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN shipments.run_sequence IS
        'Posición 1..N dentro de optimized_sequence del DeliveryRun'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN shipments.eta IS
        'ETA estimada para esta parada dentro del DeliveryRun'
    `);
    await queryRunner.query(`
      COMMENT ON TABLE delivery_runs IS
        'PARTE 7 · Sprint 1 — Manifiesto operativo diario de un driver (ver sección 29 del plan)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_shipments_delivery_run`);
    await queryRunner.query(`
      ALTER TABLE shipments
        DROP COLUMN IF EXISTS eta,
        DROP COLUMN IF EXISTS run_sequence,
        DROP COLUMN IF EXISTS delivery_run_id
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_delivery_runs_status`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_delivery_runs_driver_date`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_delivery_runs_driver`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_delivery_runs_company_date`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_delivery_runs_company`);
    await queryRunner.query(`DROP TABLE IF EXISTS delivery_runs`);
    await queryRunner.query(`DROP TYPE IF EXISTS delivery_run_status_enum`);
  }
}
