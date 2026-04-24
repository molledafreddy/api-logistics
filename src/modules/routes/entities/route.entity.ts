import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';

export type RouteStatus = 'draft' | 'active' | 'archived';

@Entity('routes')
@Index(['companyId', 'status'])
export class Route extends BaseEntity {
  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  // ─── Identificación ────────────────────
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
    comment: 'draft | active | archived',
  })
  status!: RouteStatus;

  // ─── Origen ────────────────────────────
  @Column({ type: 'varchar', length: 255, name: 'origin_address' })
  originAddress!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, name: 'origin_lat' })
  originLat!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, name: 'origin_lng' })
  originLng!: string;

  // ─── Destino ───────────────────────────
  @Column({ type: 'varchar', length: 255, name: 'destination_address' })
  destinationAddress!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, name: 'destination_lat' })
  destinationLat!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, name: 'destination_lng' })
  destinationLng!: string;

  // ─── Métricas ──────────────────────────
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'distance_km',
  })
  distanceKm!: string | null;

  @Column({ type: 'int', nullable: true, name: 'estimated_duration_min' })
  estimatedDurationMin!: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'base_price',
  })
  basePrice!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  // ─── Waypoints (paradas intermedias) ───
  @Column({ type: 'jsonb', default: [] })
  waypoints!: Array<{
    address: string;
    lat: number;
    lng: number;
    order: number;
    notes?: string;
  }>;

  // ─── Geometría / polilínea calculada ───
  @Column({ type: 'text', nullable: true, name: 'polyline_encoded' })
  polylineEncoded!: string | null;

  // ─── Metadata ──────────────────────────
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Relaciones ────────────────────────
  @ManyToOne('Company', { nullable: false, lazy: true })
  @JoinColumn({ name: 'company_id' })
  company!: Promise<import('../../companies/entities/company.entity').Company>;
}
