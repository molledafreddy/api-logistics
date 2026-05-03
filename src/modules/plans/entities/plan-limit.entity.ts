import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Unique,
  JoinColumn,
} from 'typeorm';
import { Plan } from './plan.entity';

@Entity('plan_limits')
@Unique(['planId', 'vertical', 'code'])
export class PlanLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => Plan, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ type: 'varchar', length: 50 })
  vertical: string; // Ej: 'trucking', 'delivery', 'audit', etc

  @Column({ type: 'varchar', length: 50 })
  code: string; // Ej: 'max_trucks', 'max_drivers', etc

  @Column({ type: 'int' })
  value: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
