/**
 * Tipo de carga de un Shipment.
 *
 * Nota: actualmente la columna `shipments.cargo_type` es VARCHAR(30), no un ENUM de PG.
 * Este enum centraliza los valores permitidos y se usa con `@IsEnum(CargoType)` en los DTOs.
 *
 * Extendido en Sprint 0 (PARTE 7) con `PASSENGER`, `FOOD`, `DOCUMENTS`, `MEDICAL` para
 * habilitar verticales adicionales.
 */
export enum CargoType {
  // Verticales freight (carga)
  GENERAL = 'general',
  REFRIGERATED = 'refrigerated',
  HAZARDOUS = 'hazardous',
  FRAGILE = 'fragile',
  OVERSIZED = 'oversized',
  FOOD = 'food',
  DOCUMENTS = 'documents',
  MEDICAL = 'medical',

  // Vertical passenger (personas)
  PASSENGER = 'passenger',
}

/** Subconjunto de cargos que NO aplican peso/volumen/piezas. */
export const PASSENGER_CARGO_TYPES: CargoType[] = [CargoType.PASSENGER];

/** Subconjunto freight (default). */
export const FREIGHT_CARGO_TYPES: CargoType[] = [
  CargoType.GENERAL,
  CargoType.REFRIGERATED,
  CargoType.HAZARDOUS,
  CargoType.FRAGILE,
  CargoType.OVERSIZED,
  CargoType.FOOD,
  CargoType.DOCUMENTS,
  CargoType.MEDICAL,
];

/** Todos los valores válidos como array (útil para `@IsIn()` o Swagger enum listing). */
export const ALL_CARGO_TYPES: string[] = Object.values(CargoType);
