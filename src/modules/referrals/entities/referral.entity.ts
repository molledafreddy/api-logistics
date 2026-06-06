import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export type ReferralStatus =
  | 'pending'
  | 'referred_rewarded'
  | 'completed'
  | 'expired';

@Entity('referrals')
@Index('idx_referrals_referrer_company_id', ['referrerCompanyId'])
@Index('idx_referrals_status', ['status'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'referral_link_id' })
  referralLinkId!: string;

  @Column({ type: 'uuid', name: 'referrer_company_id' })
  referrerCompanyId!: string;

  @Column({ type: 'uuid', name: 'referred_company_id', unique: true })
  referredCompanyId!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: ReferralStatus;

  @Column({ type: 'int', name: 'referrer_discount_pct' })
  referrerDiscountPct!: number;

  @Column({ type: 'int', name: 'referred_discount_pct' })
  referredDiscountPct!: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'referred_rewarded_at' })
  referredRewardedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'referrer_rewarded_at' })
  referrerRewardedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
