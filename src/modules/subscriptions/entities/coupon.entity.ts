import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 16 })
  discount_type: string;

  @Column('int', { nullable: true })
  amount_off?: number;

  @Column('int', { nullable: true })
  percent_off?: number;

  @Column('int', { nullable: true })
  max_redemptions?: number;

  @Column({ type: 'timestamptz', nullable: true })
  redeem_by?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
