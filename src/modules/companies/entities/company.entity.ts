import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { CompanyType } from '../../../common/enums/company-type.enum';
import { CompanyStatus } from '../../../common/enums/company-status.enum';
import { ServiceType } from '../../../common/enums/service-type.enum';
import { BusinessModel } from '../../../common/enums/business-model.enum';

@Entity('companies')
export class Company extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'owner_id' })
  ownerId!: string | null;

  // ─── Información básica ────────────────
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'legal_name' })
  legalName!: string | null;

  @Column({
    type: 'enum',
    enum: CompanyType,
    enumName: 'company_type_enum',
  })
  type!: CompanyType;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    enumName: 'company_status_enum',
    default: CompanyStatus.PENDING_VERIFICATION,
  })
  status!: CompanyStatus;

  // ─── Multi-vertical (PARTE 7, Sprint 0) ──
  /**
   * Vertical de servicio que ofrece la empresa.
   * freight (default) → carga. passenger → personas. mixed → ambos.
   */
  @Column({
    type: 'enum',
    enum: ServiceType,
    enumName: 'service_type_enum',
    default: ServiceType.FREIGHT,
    name: 'service_type',
  })
  serviceType!: ServiceType;

  /**
   * Modelo de negocio / tamaño operacional. Condiciona UI y gating de features.
   */
  @Column({
    type: 'enum',
    enum: BusinessModel,
    enumName: 'business_model_enum',
    default: BusinessModel.SMALL_FLEET,
    name: 'business_model',
  })
  businessModel!: BusinessModel;

  // ─── Identificadores fiscales / legales ─
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'tax_id' })
  taxId!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'mc_number' })
  mcNumber!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'dot_number' })
  dotNumber!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'scac_code' })
  scacCode!: string | null;

  // ─── Contacto ──────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website!: string | null;

  // ─── Dirección ─────────────────────────
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'address_line1',
  })
  addressLine1!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'address_line2',
  })
  addressLine2!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'zip_code' })
  zipCode!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'US' })
  country!: string;

  // ─── Branding ──────────────────────────
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'logo_url' })
  logoUrl!: string | null;

  // ─── Configuración ─────────────────────
  @Column({ type: 'jsonb', default: {} })
  settings!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'America/New_York' })
  timezone!: string;

  // ─── Referidos ─────────────────────────
  @Column({ type: 'uuid', nullable: true, name: 'referred_by_company_id' })
  referredByCompanyId!: string | null;

  // ─── Timestamps ────────────────────────
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Relations (lazy — se cargan solo cuando se necesitan) ───
  // Se definen con import type para evitar dependencias circulares.
  // TypeORM resuelve la relación por nombre de tabla/entidad.

  // Owner: el usuario que creó la empresa
  @OneToOne('User', { nullable: true, lazy: true })
  @JoinColumn({ name: 'owner_id' })
  owner!: Promise<import('../../auth/entities/user.entity').User | null>;

  // Empleados: todos los usuarios vinculados a esta empresa
  @OneToMany('User', 'company', { lazy: true })
  employees!: Promise<import('../../auth/entities/user.entity').User[]>;

  // ─── Computed ──────────────────────────
  get isActive(): boolean {
    return this.status === CompanyStatus.ACTIVE;
  }

  get isPendingVerification(): boolean {
    return this.status === CompanyStatus.PENDING_VERIFICATION;
  }

  get fullAddress(): string {
    const parts = [
      this.addressLine1,
      this.addressLine2,
      this.city,
      this.state,
      this.zipCode,
      this.country,
    ].filter(Boolean);
    return parts.join(', ');
  }
}
