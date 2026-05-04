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

  // ─── Sprint E — idempotencia por provider ─────
  /** 'mercadopago' | 'stripe' | 'manual' | etc. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  provider?: string | null;

  /** Id del payment/event en el provider externo (para deduplicar webhooks). */
  @Column({ type: 'varchar', length: 120, nullable: true, name: 'external_id' })
  external_id?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
