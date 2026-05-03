import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';

/**
 * Sprint C.5 — Dirección favorita por compañía.
 *
 * Reutiliza el shape del módulo Geocoding (`placeId`, `confidence`) para que
 * un favorito creado a partir de `/v1/geocoding/search` se persista sin
 * pérdida de información.
 */
@Entity('saved_addresses')
@Index(['companyId', 'kind'])
@Index(['companyId', 'label'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class SavedAddress extends BaseEntity {
  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy!: string | null;

  // ─── Identificación ────────────────────
  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ type: 'varchar', length: 30, default: 'other' })
  kind!: string;

  // ─── Dirección ─────────────────────────
  @Column({ type: 'varchar', length: 500 })
  formatted!: string;

  // numeric → string en TypeORM (mismo patrón que confidence en shipments)
  @Column({ type: 'numeric', precision: 9, scale: 6 })
  lat!: string;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  lng!: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'place_id' })
  placeId!: string | null;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  confidence!: string | null;

  // ─── Metadatos opcionales ──────────────
  @Column({ type: 'varchar', length: 8, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  locality!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postcode!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // ─── Soft delete ───────────────────────
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Relations (lazy / opcional) ───────
  @ManyToOne('Company', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: unknown;
}
