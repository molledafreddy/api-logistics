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
/**
 * Claves conocidas de la vertical "global".
 * Usado por guards y servicios para acceso con autocompletion.
 */
export interface GlobalLimits {
  maxShipmentsPerDay?: number;
  maxStopsPerOptimization?: number;
  maxReoptimizationsPerDay?: number;
  max_drivers?: number;
  max_templates?: number;
}

/** Claves conocidas de la vertical "trucking". */
export interface TruckingLimits {
  max_trucks?: number;
}

/**
 * Mapa de límites materializado en `plans.limits` (jsonb).
 * Cada clave es una vertical; el valor es un mapa de code → número.
 * La vertical "global" y "trucking" tienen claves conocidas tipadas.
 */
export interface PlanLimitsMap {
  global?: Record<string, number>;
  trucking?: Record<string, number>;
  [vertical: string]: Record<string, number> | undefined;
}

/** Vertical reservada para límites globales del plan. */
export const PLAN_LIMITS_GLOBAL_VERTICAL = 'global';
