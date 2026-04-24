import { Entity, Column, Index, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { DeliveryRunStatus } from '../../../common/enums/delivery-run-status.enum';

/**
 * DeliveryRun — Manifiesto operativo del día (PARTE 7 · sección 29).
 *
 * Agrupa N shipments asignados a un driver para una fecha/turno específico.
 * Funciona para ambas verticales:
 *   - freight   → ruta de reparto (shipments = packages)
 *   - passenger → ruta escolar (shipments = paradas con pasajeros)
 *
 * Multi-tenant estricto: siempre pertenece al `companyId` carrier.
 */
@Entity('delivery_runs')
@Index('idx_delivery_runs_company_date', ['companyId', 'scheduledDate'])
@Index('idx_delivery_runs_driver_date', ['driverId', 'scheduledDate'])
export class DeliveryRun extends BaseEntity {
  // ─── Tenant ──────────────────────────
  @Index('idx_delivery_runs_company')
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  // ─── Identificación ──────────────────
  @Column({ type: 'varchar', length: 150 })
  name!: string; // p.ej. "AM Lincoln Elementary"

  @Column({ type: 'date', name: 'scheduled_date' })
  scheduledDate!: string; // formato 'YYYY-MM-DD'

  @Column({ type: 'varchar', length: 20, default: 'morning' })
  shift!: 'morning' | 'afternoon' | 'evening' | 'night' | 'custom';

  @Column({ type: 'time', nullable: true, name: 'start_time' })
  startTime!: string | null;

  // ─── Asignaciones ────────────────────
  @Index('idx_delivery_runs_driver')
  @Column({ type: 'uuid', nullable: true, name: 'driver_id' })
  driverId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'truck_id' })
  truckId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'route_id' })
  routeId!: string | null;

  // ─── Estado ──────────────────────────
  @Column({
    type: 'enum',
    enum: DeliveryRunStatus,
    enumName: 'delivery_run_status_enum',
    default: DeliveryRunStatus.PLANNED,
  })
  status!: DeliveryRunStatus;

  // ─── Métricas precomputadas ──────────
  @Column({ type: 'int', default: 0, name: 'total_stops' })
  totalStops!: number;

  @Column({ type: 'int', default: 0, name: 'completed_stops' })
  completedStops!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'estimated_distance_km',
  })
  estimatedDistanceKm!: string | null;

  @Column({ type: 'int', nullable: true, name: 'estimated_duration_min' })
  estimatedDurationMin!: number | null;

  // ─── Secuencia de shipments (denormalizada) ─────────
  // Mantiene el orden de visita. DR-007 garantiza correspondencia 1:1
  // con los shipments cuyo deliveryRunId apunta a este run.
  @Column({ type: 'jsonb', default: () => "'[]'", name: 'optimized_sequence' })
  optimizedSequence!: string[];

  // ─── Tiempos del ciclo ───────────────
  @Column({ type: 'timestamptz', nullable: true, name: 'started_at' })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'finished_at' })
  finishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancel_reason' })
  cancelReason!: string | null;

  // ─── Plantilla de origen (Sprint 2 · RecurringTemplate) ───
  @Column({ type: 'uuid', nullable: true, name: 'recurring_template_id' })
  recurringTemplateId!: string | null;

  // ─── Optimización (Sprint 7) ─────────
  @Column({ type: 'timestamptz', nullable: true, name: 'optimized_at' })
  optimizedAt!: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'optimization_provider',
  })
  optimizationProvider!: string | null;

  /**
   * ETA por stop precomputado en la última optimización.
   * Estructura: [{ shipmentId, etaAt, distanceFromPrevKm, durationFromPrevMin }]
   * Se recalcula on-the-fly por `EtaService.computeLive()` usando el último GPS.
   */
  @Column({ type: 'jsonb', default: () => "'[]'", name: 'eta_per_stop' })
  etaPerStop!: Array<{
    shipmentId: string;
    etaAt: string | null;
    distanceFromPrevKm: number;
    durationFromPrevMin: number;
  }>;

  // ─── Metadata libre ──────────────────
  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Computed ────────────────────────
  get isOpen(): boolean {
    return (
      this.status !== DeliveryRunStatus.COMPLETED &&
      this.status !== DeliveryRunStatus.CANCELLED
    );
  }

  get progress(): number {
    if (!this.totalStops) return 0;
    return Math.round((this.completedStops / this.totalStops) * 100);
  }
}
