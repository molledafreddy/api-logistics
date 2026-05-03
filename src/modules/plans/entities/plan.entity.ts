import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PlanAudience } from '../enums/plan-audience.enum';
import { PlanTier } from '../enums/plan-tier.enum';
import type { PlanLimitsMap } from '../interfaces/plan-limits-map.interface';
import { PlanLimit } from './plan-limit.entity';
import { PlanPermission } from './plan-permission.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 50 })
  name: string;

  /**
   * Slug estable usado por la lógica del sistema (no acoplado a `name`).
   * Ej: 'free_courier', 'pro_courier', 'enterprise_fleet'.
   * Sprint A — Anexo V3.
   */
  @Index('plans_code_unique', { unique: true, where: 'code IS NOT NULL' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  /** Audiencia del plan. Sprint A — Anexo V3. */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    enum: PlanAudience,
  })
  audience: PlanAudience | null;

  /** Tier del plan. Sprint A — Anexo V3. */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    enum: PlanTier,
  })
  tier: PlanTier | null;

  /**
   * Límites cuantitativos del plan, materializados como jsonb para lecturas O(1)
   * desde guards (ej. OptimizationLimitsGuard).
   *
   * Fuente de verdad: tabla `plan_limits`. Este campo se sincroniza
   * automáticamente desde `PlansService` cuando se crea/actualiza/elimina
   * un PlanLimit, y desde `PATCH /plans/:id/limits` directamente.
   */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb`, nullable: false })
  limits: PlanLimitsMap;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'varchar', length: 20, default: 'month' })
  interval: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // ─── Relaciones ────────────────────────────────────────────────
  @OneToMany(() => PlanLimit, (pl) => pl.plan)
  planLimits?: PlanLimit[];

  @OneToMany(() => PlanPermission, (pp) => pp.plan)
  planPermissions?: PlanPermission[];
}
