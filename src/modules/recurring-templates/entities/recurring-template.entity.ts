import { Entity, Column, Index, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { RecurrencePattern } from '../../../common/enums/recurrence-pattern.enum';

/**
 * Snapshot de un shipment a generar en cada ocurrencia. Son los datos mínimos
 * necesarios para crear un Shipment "real" cuando dispara el cron.
 *
 * Para verticales:
 *  - freight   → cargoType = 'general'|'refrigerated'|'fragile'|...
 *  - passenger → cargoType = 'passenger', metadata.passenger.fullName, etc.
 */
export interface ShipmentTemplateSnapshot {
  originAddress: string;
  originLat?: string | null;
  originLng?: string | null;
  destinationAddress: string;
  destinationLat?: string | null;
  destinationLng?: string | null;
  description: string;
  cargoType: string;
  weightKg?: string | null;
  volumeM3?: string | null;
  pieces?: number | null;
  customerCompanyId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * RecurringTemplate — Plantilla de generación automática (PARTE 7 · sección 30).
 *
 * Una plantilla puede generar:
 *  - 1 DeliveryRun por ocurrencia (con `recurringTemplateId = template.id`)
 *  - N Shipments (uno por entrada en `shipmentTemplates`), todos asociados al run.
 *
 * El cron `recurring-generator` corre 23:00 UTC y genera la ocurrencia de mañana.
 * También se puede invocar manualmente vía `POST /:id/generate?date=YYYY-MM-DD`.
 *
 * Idempotencia: el índice único parcial sobre `delivery_runs(recurring_template_id, scheduled_date)`
 * garantiza que un mismo template no genere 2 runs activos para la misma fecha (RT-002).
 */
@Entity('recurring_templates')
@Index('idx_recurring_templates_company_active', ['companyId', 'active'])
export class RecurringTemplate extends BaseEntity {
  @Index('idx_recurring_templates_company')
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: RecurrencePattern.WEEKLY })
  pattern!: RecurrencePattern;

  /** Solo aplica a pattern=weekly. ISO day numbers (1=mon..7=sun). */
  @Column({ type: 'jsonb', default: () => "'[]'", name: 'days_of_week' })
  daysOfWeek!: number[];

  @Column({ type: 'time' })
  time!: string; // "07:00"

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate!: string | null;

  /** Fechas a saltar en formato 'YYYY-MM-DD' (feriados, etc.). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  exceptions!: string[];

  @Column({ type: 'uuid', nullable: true, name: 'driver_id' })
  driverId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'truck_id' })
  truckId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'route_id' })
  routeId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'", name: 'shipment_templates' })
  shipmentTemplates!: ShipmentTemplateSnapshot[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_generated_at' })
  lastGeneratedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Computed ────────────────────────
  /** ¿La plantilla aplica para la fecha dada (sin contar exceptions)? */
  appliesTo(dateISO: string): boolean {
    if (!this.active) return false;
    if (dateISO < this.startDate) return false;
    if (this.endDate && dateISO > this.endDate) return false;
    if (this.exceptions?.includes(dateISO)) return false;

    const date = new Date(`${dateISO}T00:00:00Z`);
    const isoDay = ((date.getUTCDay() + 6) % 7) + 1; // 1=mon..7=sun

    switch (this.pattern) {
      case RecurrencePattern.DAILY:
        return true;
      case RecurrencePattern.WEEKLY:
        return (
          Array.isArray(this.daysOfWeek) && this.daysOfWeek.includes(isoDay)
        );
      case RecurrencePattern.MONTHLY: {
        const startDay = parseInt(this.startDate.slice(8, 10), 10);
        return date.getUTCDate() === startDay;
      }
      case RecurrencePattern.CUSTOM:
        return false;
      default:
        return false;
    }
  }
}
