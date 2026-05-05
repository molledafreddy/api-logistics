import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  company_id: string;

  @Column('uuid')
  plan_id: string;

  @Column({ type: 'varchar', length: 32 })
  status: string;

  @Column({ type: 'timestamptz' })
  current_period_start: Date;

  @Column({ type: 'timestamptz' })
  current_period_end: Date;

  @Column({ type: 'boolean', default: false })
  cancel_at_period_end: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  trial_start?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  trial_end?: Date;

  // ─── Pagos (Sprint E) ───────────────────
  /** 'free' | 'mercadopago' | 'stripe' (futuro). */
  @Column({ type: 'varchar', length: 20, default: 'free' })
  provider: string;

  /** Id de preapproval/subscription del provider externo. */
  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    name: 'provider_subscription_id',
  })
  provider_subscription_id?: string | null;

  /** Token de idempotencia que viaja al checkout y vuelve en el webhook. */
  @Column({
    type: 'varchar',
    length: 80,
    nullable: true,
    name: 'external_reference',
  })
  external_reference?: string | null;

  // ─── Renovación automática (Sprint F.1) ─────
  /** Hasta cuándo aceptamos pago atrasado antes de marcar canceled. */
  @Column({ type: 'timestamptz', nullable: true })
  grace_period_until?: Date | null;

  /** Último timestamp en que el scan de renovación intentó cobrar esta sub. */
  @Column({ type: 'timestamptz', nullable: true })
  last_renewal_attempt_at?: Date | null;

  /** Init point del checkout pendiente (para que el frontend muestre "Renovar"). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  last_renewal_init_point?: string | null;

  // ─── Lifecycle suspended/reactivado (Sprint F.2) ─────
  /** Momento en que la sub pasó a `suspended` por gracia agotada. */
  @Column({ type: 'timestamptz', nullable: true })
  suspended_at?: Date | null;

  /** Momento del último pago aprobado tras `pending_payment` o `suspended`. */
  @Column({ type: 'timestamptz', nullable: true })
  reactivated_at?: Date | null;

  /** Idempotencia: cuándo se envió la notificación "tu gracia vence en 24h". */
  @Column({ type: 'timestamptz', nullable: true })
  grace_warning_sent_at?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
