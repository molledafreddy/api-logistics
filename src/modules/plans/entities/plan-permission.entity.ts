import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Plan } from './plan.entity';
import { PermissionDefinition } from './permission-definition.entity';

@Entity('plan_permissions')
@Unique(['plan', 'permission'])
export class PlanPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Plan, { nullable: false, onDelete: 'CASCADE' })
  plan: Plan;

  @ManyToOne(() => PermissionDefinition, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  permission: PermissionDefinition;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
