import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum';

@Entity('shipments')
@Index(['companyId', 'status'])
@Index(['companyId', 'trackingCode'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Shipment extends BaseEntity {
  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  // Empresa cliente que origina la carga (puede ser distinta del carrier)
  @Column({ type: 'uuid', nullable: true, name: 'customer_company_id' })
  customerCompanyId!: string | null;

  // ─── Identificación ────────────────────
  @Column({ type: 'varchar', length: 50, name: 'tracking_code' })
  trackingCode!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'reference_number',
  })
  referenceNumber!: string | null;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    enumName: 'shipment_status_enum',
    default: ShipmentStatus.DRAFT,
  })
  status!: ShipmentStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'normal',
    comment: 'low | normal | high | urgent',
  })
  priority!: string;

  // ─── Asignaciones ──────────────────────
  @Column({ type: 'uuid', nullable: true, name: 'route_id' })
  routeId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'truck_id' })
  truckId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'driver_id' })
  driverId!: string | null;

  // ─── PARTE 7 · Sprint 1 · DeliveryRun ──
  // Si != null el shipment está agrupado en un manifiesto operativo del día.
  @Index('idx_shipments_delivery_run')
  @Column({ type: 'uuid', nullable: true, name: 'delivery_run_id' })
  deliveryRunId!: string | null;

  // Posición 1..N dentro de la secuencia del run (null si no está en run).
  @Column({ type: 'int', nullable: true, name: 'run_sequence' })
  runSequence!: number | null;

  // ETA estimada para este stop dentro del run.
  @Column({ type: 'timestamptz', nullable: true })
  eta!: Date | null;

  // ─── Origen ────────────────────────────
  @Column({ type: 'varchar', length: 255, name: 'origin_address' })
  originAddress!: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    name: 'origin_lat',
  })
  originLat!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    name: 'origin_lng',
  })
  originLng!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'origin_contact_name',
  })
  originContactName!: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    name: 'origin_contact_phone',
  })
  originContactPhone!: string | null;

  // ─── Destino ───────────────────────────
  @Column({ type: 'varchar', length: 255, name: 'destination_address' })
  destinationAddress!: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    name: 'destination_lat',
  })
  destinationLat!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    name: 'destination_lng',
  })
  destinationLng!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'destination_contact_name',
  })
  destinationContactName!: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    name: 'destination_contact_phone',
  })
  destinationContactPhone!: string | null;

  // ─── Carga ─────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'weight_kg',
  })
  weightKg!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'volume_m3',
  })
  volumeM3!: string | null;

  @Column({ type: 'int', nullable: true })
  pieces!: number | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'general',
    comment: 'general | refrigerated | hazardous | fragile | oversized',
  })
  cargoType!: string;

  // ─── Fechas ────────────────────────────
  @Column({ type: 'timestamptz', nullable: true, name: 'pickup_at' })
  pickupAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'delivery_at' })
  deliveryAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'picked_up_at' })
  pickedUpAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'delivered_at' })
  deliveredAt!: Date | null;

  // ─── Pricing ───────────────────────────
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  // ─── POD (Proof of Delivery) ───────────
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'pod_url' })
  podUrl!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'pod_signed_by',
  })
  podSignedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'pod_uploaded_at' })
  podUploadedAt!: Date | null;

  // ─── Cancelación ───────────────────────
  @Column({ type: 'text', nullable: true, name: 'cancel_reason' })
  cancelReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt!: Date | null;

  // ─── Workflow de aceptación cross-company ──
  @Column({ type: 'uuid', nullable: true, name: 'proposed_by' })
  proposedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'proposed_at' })
  proposedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'accepted_by' })
  acceptedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'accepted_at' })
  acceptedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'rejected_by' })
  rejectedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'rejected_at' })
  rejectedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason!: string | null;

  // ─── Metadata ──────────────────────────
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Relaciones (lazy) ─────────────────
  @ManyToOne('Company', { nullable: false, lazy: true })
  @JoinColumn({ name: 'company_id' })
  company!: Promise<import('../../companies/entities/company.entity').Company>;

  // ─── Computed ──────────────────────────
  get isActive(): boolean {
    return ![ShipmentStatus.COMPLETED, ShipmentStatus.CANCELLED].includes(
      this.status,
    );
  }

  get isAssigned(): boolean {
    return this.driverId !== null && this.truckId !== null;
  }
}
