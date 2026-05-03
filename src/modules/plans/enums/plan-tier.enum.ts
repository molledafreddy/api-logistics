/**
 * Tier (nivel) de un plan dentro de su audience.
 *
 * - FREE       : sin costo, límites estrictos, optimización local
 * - PRO        : pago, optimización con tráfico real, más capacidad
 * - ENTERPRISE : pago alto, capacidades avanzadas (VRP, multi-vehículo, etc.)
 */
export enum PlanTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export const ALL_PLAN_TIERS = Object.values(PlanTier);
