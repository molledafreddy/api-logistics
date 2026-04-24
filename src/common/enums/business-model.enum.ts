/**
 * Modelo de negocio / tamaño operacional de una empresa.
 *
 * - INDEPENDENT → transportista solo (1-3 vehículos, autoempleado). Apto para plan FREE.
 * - SMALL_FLEET → PYME (5-30 vehículos). Plan básico-pro.
 * - ENTERPRISE  → operador grande (50+ vehículos). Plan enterprise + features avanzadas.
 *
 * Introducido en Sprint 0 (PARTE 7 del plan). Se usa junto con `ServiceType` para
 * modular UI y gating de features vía `@RequireBusinessModel()`.
 */
export enum BusinessModel {
  INDEPENDENT = 'independent',
  SMALL_FLEET = 'small_fleet',
  ENTERPRISE = 'enterprise',
}
