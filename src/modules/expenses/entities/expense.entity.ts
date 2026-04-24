import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { ExpenseStatus } from '../../../common/enums/expense-status.enum';

@Entity('expenses')
@Index(['companyId', 'status'])
@Index(['companyId', 'expenseDate'])
export class Expense extends BaseEntity {
  // ─── Tenant ────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  // ─── Relación opcional ─────────────────
  @Column({ type: 'uuid', nullable: true, name: 'shipment_id' })
  shipmentId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'truck_id' })
  truckId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'driver_id' })
  driverId!: string | null;

  // ─── Datos del gasto ───────────────────
  @Column({
    type: 'varchar',
    length: 30,
    comment:
      'fuel | toll | maintenance | parking | meal | lodging | repair | other',
  })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'date', name: 'expense_date' })
  expenseDate!: Date;

  // ─── Status / aprobación ───────────────
  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    enumName: 'expense_status_enum',
    default: ExpenseStatus.PENDING,
  })
  status!: ExpenseStatus;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_at' })
  approvedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reimbursed_at' })
  reimbursedAt!: Date | null;

  // ─── Comprobante / archivo ─────────────
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'receipt_url' })
  receiptUrl!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'vendor_name' })
  vendorName!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'payment_method',
  })
  paymentMethod!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne('Company', { nullable: false, lazy: true })
  @JoinColumn({ name: 'company_id' })
  company!: Promise<import('../../companies/entities/company.entity').Company>;

  get isApproved(): boolean {
    return (
      this.status === ExpenseStatus.APPROVED ||
      this.status === ExpenseStatus.REIMBURSED
    );
  }
}
