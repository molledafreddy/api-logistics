import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('referral_config')
export class ReferralConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int', name: 'referrer_discount_pct', default: 20 })
  referrerDiscountPct!: number;

  @Column({ type: 'int', name: 'referred_discount_pct', default: 30 })
  referredDiscountPct!: number;

  @Column({ type: 'int', name: 'link_ttl_hours', default: 72 })
  linkTtlHours!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt!: Date;
}
