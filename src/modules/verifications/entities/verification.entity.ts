import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { VerificationStatus } from '../../../common/enums/verification-status.enum';
import { VerificationTier } from './verification-tier.entity';
import { VerificationDocument } from './verification-document.entity';

@Entity('verifications')
export class Verification extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'tier_id' })
  tierId!: string;

  @ManyToOne(() => VerificationTier)
  @JoinColumn({ name: 'tier_id' })
  tier!: VerificationTier;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    enumName: 'verification_status_enum',
    default: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'submitted_at' })
  submittedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to' })
  assignedTo!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'assigned_at' })
  assignedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_at' })
  approvedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'rejected_at' })
  rejectedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  expiresAt!: Date | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'amount_paid',
  })
  amountPaid!: number;

  @Column({ type: 'text', nullable: true, name: 'review_notes' })
  reviewNotes!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @OneToMany(() => VerificationDocument, (doc) => doc.verification)
  documents!: VerificationDocument[];
}
