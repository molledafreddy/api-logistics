/**
 * Forma del campo `Plan.limits` (jsonb materializado).
 *
 * Convención: `{ [vertical]: { [code]: number } }`.
 * Se mantiene como tabla `plan_limits` (fuente de verdad versionada y auditable),
 * pero se materializa aquí como denormalización para lecturas O(1) en guards
 * (ej. OptimizationLimitsGuard del Sprint B).
 *
 * Ejemplo:
 * ```json
 * {
 *   "trucking": { "max_trucks": 10 },
 *   "delivery": { "max_drivers": 5 },
 *   "global":   { "maxShipmentsPerDay": 200, "maxStopsPerOptimization": 50 }
 * }
 * ```
 *
 * La vertical especial `global` se reserva para límites no asociados a una
 * vertical concreta (compatibilidad con el modelo del Anexo V3).
 */
export interface PlanLimitsMap {
  [vertical: string]: {
    [code: string]: number;
  };
}

/** Vertical reservada para límites globales del plan. */
export const PLAN_LIMITS_GLOBAL_VERTICAL = 'global';
