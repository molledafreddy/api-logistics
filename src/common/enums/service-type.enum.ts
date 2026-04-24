/**
 * Tipo de servicio que ofrece una empresa.
 *
 * - FREIGHT   → transporte de carga (paquetes, pallets, mercancía). Default histórico.
 * - PASSENGER → transporte de personas (escolar, médico, corporativo).
 * - MIXED     → empresa que opera ambas verticales (raro pero posible).
 *
 * Introducido en Sprint 0 (PARTE 7 del plan) para habilitar el producto multi-vertical.
 * La columna `companies.service_type` condiciona UI, validaciones y tier de verificación.
 */
export enum ServiceType {
  FREIGHT = 'freight',
  PASSENGER = 'passenger',
  MIXED = 'mixed',
}
