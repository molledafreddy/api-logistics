import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { RelationshipStatus } from '../../../common/enums/relationship-status.enum';

@Entity('company_relationship_logs')
export class CompanyRelationshipLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'relationship_id' })
  relationshipId!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({
    type: 'enum',
    enum: RelationshipStatus,
    enumName: 'relationship_status_enum',
    nullable: true,
    name: 'from_status',
  })
  fromStatus!: RelationshipStatus | null;

  @Column({
    type: 'enum',
    enum: RelationshipStatus,
    enumName: 'relationship_status_enum',
    name: 'to_status',
  })
  toStatus!: RelationshipStatus;

  @Column({ type: 'uuid', nullable: true, name: 'performed_by' })
  performedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
