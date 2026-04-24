import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { TruckStatus } from '../../../common/enums/truck-status.enum';

@Entity('trucks')
@Index(['companyId', 'status'])
@Index(['companyId', 'plate'], { unique: true, where: '"deleted_at" IS NULL' })
export class Truck extends BaseEntity {
  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  // ─── Identificación ────────────────────
  @Column({ type: 'varchar', length: 20 })
  plate!: string;

  @Column({ type: 'varchar', length: 17, nullable: true })
  vin!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  make!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model!: string | null;

  @Column({ type: 'int', nullable: true })
  year!: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color!: string | null;

  // ─── Capacidad / Specs ─────────────────
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'flatbed | reefer | dry-van | tanker | box | other',
  })
  type!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'capacity_kg',
  })
  capacityKg!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'capacity_volume_m3',
  })
  capacityVolumeM3!: string | null;

  // ─── Estado ────────────────────────────
  @Column({
    type: 'enum',
    enum: TruckStatus,
    enumName: 'truck_status_enum',
    default: TruckStatus.AVAILABLE,
  })
  status!: TruckStatus;

  // ─── Driver asignado actualmente ───────
  @Column({ type: 'uuid', nullable: true, name: 'current_driver_id' })
  currentDriverId!: string | null;

  // ─── Documentación / fechas legales ────
  @Column({ type: 'date', nullable: true, name: 'insurance_expires_at' })
  insuranceExpiresAt!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'registration_expires_at' })
  registrationExpiresAt!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'last_maintenance_at' })
  lastMaintenanceAt!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'next_maintenance_at' })
  nextMaintenanceAt!: Date | null;

  @Column({ type: 'int', nullable: true, name: 'odometer_km' })
  odometerKm!: number | null;

  // ─── Telemetría / ubicación reciente ───
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    name: 'last_lat',
  })
  lastLat!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    name: 'last_lng',
  })
  lastLng!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_location_at' })
  lastLocationAt!: Date | null;

  // ─── Notas y metadata ──────────────────
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  // ─── Timestamps ────────────────────────
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Relaciones (lazy) ─────────────────
  @ManyToOne('Company', { nullable: false, lazy: true })
  @JoinColumn({ name: 'company_id' })
  company!: Promise<import('../../companies/entities/company.entity').Company>;

  // ─── Computed ──────────────────────────
  get isAvailable(): boolean {
    return this.status === TruckStatus.AVAILABLE;
  }

  get isInTransit(): boolean {
    return this.status === TruckStatus.IN_TRANSIT;
  }

  get hasDriver(): boolean {
    return this.currentDriverId !== null;
  }
}
