import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RelationshipType } from '../../../common/enums/relationship-type.enum';
import { RelationshipStatus } from '../../../common/enums/relationship-status.enum';

@Entity('company_relationships')
export class CompanyRelationship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'parent_company_id' })
  parentCompanyId!: string;

  @Column({ type: 'uuid', name: 'child_company_id' })
  childCompanyId!: string;

  @Column({
    type: 'enum',
    enum: RelationshipType,
    enumName: 'relationship_type_enum',
    name: 'relationship_type',
  })
  relationshipType!: RelationshipType;

  @Column({
    type: 'enum',
    enum: RelationshipStatus,
    enumName: 'relationship_status_enum',
    default: RelationshipStatus.PENDING,
  })
  status!: RelationshipStatus;

  @Column({ type: 'uuid', nullable: true, name: 'invited_by' })
  invitedBy!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'invitation_email',
  })
  invitationEmail!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
    name: 'invitation_token',
  })
  invitationToken!: string | null;

  @Column({ type: 'text', nullable: true, name: 'invitation_message' })
  invitationMessage!: string | null;

  @Column({ type: 'timestamptz', name: 'invited_at', default: () => 'NOW()' })
  invitedAt!: Date;

  @Column({ type: 'uuid', nullable: true, name: 'responded_by' })
  respondedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'accepted_at' })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'rejected_at' })
  rejectedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'terminated_at' })
  terminatedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'terminated_reason' })
  terminatedReason!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  config!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
