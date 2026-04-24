import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';

@Entity('verification_tiers')
export class VerificationTier extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'int', name: 'validity_days', default: 365 })
  validityDays!: number;

  @Column({ type: 'jsonb', name: 'required_documents', default: '[]' })
  requiredDocuments!: string[];

  @Column({ type: 'jsonb', default: '{}' })
  requirements!: Record<string, unknown>;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'badge_color' })
  badgeColor!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'badge_icon' })
  badgeIcon!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;
}
