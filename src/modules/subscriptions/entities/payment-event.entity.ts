import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('payment_events')
export class PaymentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  subscription_id: string;

  @Column({ type: 'varchar', length: 32 })
  event_type: string;

  @Column('int', { nullable: true })
  amount?: number;

  @Column({ type: 'timestamptz' })
  event_date: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
