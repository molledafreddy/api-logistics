import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 7 — Sprint 2 · RecurringTemplate
 *
 * Crea la tabla `recurring_templates` (plantillas de generación automática de
 * DeliveryRun + Shipments) y un índice único parcial para idempotencia
 * (no se permite > 1 run abierto generado por la misma plantilla en la misma fecha).
 *
 * Compatibilidad: 100% hacia atrás. Ningún cambio destructivo en tablas existentes.
 */
export class CreateRecurringTemplates1708000000003 implements MigrationInterface {
  name = 'CreateRecurringTemplates1708000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla recurring_templates
    await queryRunner.query(`
      CREATE TABLE recurring_templates (
        id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id            UUID         NOT NULL,
        name                  VARCHAR(150) NOT NULL,
        pattern               VARCHAR(20)  NOT NULL DEFAULT 'weekly',
        days_of_week          JSONB        NOT NULL DEFAULT '[]',
        time                  TIME         NOT NULL,
        start_date            DATE         NOT NULL,
        end_date              DATE         NULL,
        exceptions            JSONB        NOT NULL DEFAULT '[]',
        driver_id             UUID         NULL,
        truck_id              UUID         NULL,
        route_id              UUID         NULL,
        shipment_templates    JSONB        NOT NULL DEFAULT '[]',
        active                BOOLEAN      NOT NULL DEFAULT TRUE,
        last_generated_at     TIMESTAMPTZ  NULL,
        metadata              JSONB        NOT NULL DEFAULT '{}',
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ  NULL
      )
    `);

    // 2. Índices recurring_templates
    await queryRunner.query(
      `CREATE INDEX idx_recurring_templates_company        ON recurring_templates (company_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_recurring_templates_company_active ON recurring_templates (company_id, active)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_recurring_templates_active_pattern ON recurring_templates (active, pattern)
         WHERE deleted_at IS NULL`,
    );

    // 3. Idempotencia (RT-002): a lo sumo un DeliveryRun por (template, fecha)
    //    excluyendo cancelados (permite regenerar tras cancel).
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_delivery_runs_template_date_unique
        ON delivery_runs (recurring_template_id, scheduled_date)
        WHERE recurring_template_id IS NOT NULL
          AND deleted_at IS NULL
          AND status <> 'cancelled'
    `);

    // 4. Comentarios
    await queryRunner.query(`
      COMMENT ON TABLE recurring_templates IS
        'PARTE 7 · Sprint 2 — Plantillas de generación automática de DeliveryRun + Shipments (sección 30 del plan)'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recurring_templates.pattern IS
        'daily | weekly | monthly | custom — ver RecurrencePattern enum'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recurring_templates.days_of_week IS
        'Solo aplica a pattern=weekly. Array de números ISO 1..7 (1=lun, 7=dom)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_delivery_runs_template_date_unique`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_recurring_templates_active_pattern`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_recurring_templates_company_active`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_recurring_templates_company`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS recurring_templates`);
  }
}
