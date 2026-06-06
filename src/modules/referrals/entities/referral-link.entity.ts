import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('referral_links')
@Index('idx_referral_links_company_id', ['companyId'])
export class ReferralLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Index('idx_referral_links_token')
  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'int', name: 'max_uses', default: 1 })
  maxUses!: number;

  @Column({ type: 'int', name: 'times_used', default: 0 })
  timesUsed!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
