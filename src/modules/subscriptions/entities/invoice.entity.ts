import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  subscription_id: string;

  @Column('int')
  amount_due: number;

  @Column('int')
  amount_paid: number;

  @Column({ type: 'varchar', length: 32 })
  status: string;

  @Column({ type: 'timestamptz' })
  due_date: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
