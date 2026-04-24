import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { DriverStatus } from '../../../common/enums/driver-status.enum';

@Entity('drivers')
@Index(['companyId', 'status'])
@Index(['companyId', 'licenseNumber'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Driver extends BaseEntity {
  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  // ─── Vínculo opcional al usuario del sistema ───
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId!: string | null;

  // ─── Datos personales ──────────────────
  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'date', nullable: true, name: 'birth_date' })
  birthDate!: Date | null;

  // ─── Licencia ──────────────────────────
  @Column({ type: 'varchar', length: 50, name: 'license_number' })
  licenseNumber!: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'license_class',
  })
  licenseClass!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'license_state',
  })
  licenseState!: string | null;

  @Column({ type: 'date', nullable: true, name: 'license_expires_at' })
  licenseExpiresAt!: Date | null;

  // ─── Estado y métricas ─────────────────
  @Column({
    type: 'enum',
    enum: DriverStatus,
    enumName: 'driver_status_enum',
    default: DriverStatus.AVAILABLE,
  })
  status!: DriverStatus;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    name: 'rating_avg',
  })
  ratingAvg!: string;

  @Column({ type: 'int', default: 0, name: 'total_trips' })
  totalTrips!: number;

  // ─── Camión actualmente asignado ───────
  @Column({ type: 'uuid', nullable: true, name: 'current_truck_id' })
  currentTruckId!: string | null;

  // ─── Dirección ─────────────────────────
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'address_line1',
  })
  addressLine1!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'zip_code' })
  zipCode!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'US' })
  country!: string;

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
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get isAvailable(): boolean {
    return this.status === DriverStatus.AVAILABLE;
  }

  get hasTruck(): boolean {
    return this.currentTruckId !== null;
  }
}
