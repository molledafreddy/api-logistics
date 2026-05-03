/**
 * Audiencia de un plan según el segmento al que se dirige.
 *
 * - COURIER     : transportistas individuales / repartidores ("courier" en inglés)
 * - PASSENGER   : transporte de personas (escolares, ride-share, etc.)
 * - FLEET       : empresas con flotas medianas/grandes
 * - ANY         : plan genérico (legacy / general)
 */
export enum PlanAudience {
  COURIER = 'courier',
  PASSENGER = 'passenger',
  FLEET = 'fleet',
  ANY = 'any',
}

export const ALL_PLAN_AUDIENCES = Object.values(PlanAudience);
