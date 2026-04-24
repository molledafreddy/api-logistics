import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * Punto de tracking GPS / telemetría.
 * Tabla pensada para alta cardinalidad (idealmente particionada por mes).
 */
@Entity('tracking_points')
@Index(['shipmentId', 'capturedAt'])
@Index(['truckId', 'capturedAt'])
export class TrackingPoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  // ─── Origen del punto ──────────────────
  @Column({ type: 'uuid', nullable: true, name: 'shipment_id' })
  shipmentId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'truck_id' })
  truckId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'driver_id' })
  driverId!: string | null;

  // ─── Datos GPS ─────────────────────────
  @Column({ type: 'numeric', precision: 10, scale: 7 })
  lat!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  lng!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  speed!: string | null; // km/h

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  heading!: string | null; // grados

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  altitude!: string | null; // metros

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  accuracy!: string | null; // metros

  // ─── Eventos ───────────────────────────
  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    comment: 'pickup | delivery | stop | start | resume | incident | none',
  })
  event!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  // ─── Timestamps ────────────────────────
  @Column({ type: 'timestamptz', name: 'captured_at' })
  capturedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
