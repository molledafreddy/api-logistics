/**
 * Contrato del campo JSONB `shipments.metadata`.
 *
 * El campo existe desde el plan v5.0 como `metadata: Record<string, unknown>`. En
 * Sprint 0 de PARTE 7 se tipa formalmente para habilitar datos vertical-specific
 * sin migraciones adicionales.
 *
 * Convenciones:
 * - Un shipment de `cargoType = 'passenger'` DEBE poblar `metadata.passenger`.
 * - Un shipment freight PUEDE poblar `metadata.freight` (todas sus keys opcionales).
 * - `custom` queda libre para extensiones por company (respetado, nunca sobreescrito).
 */
export interface ShipmentMetadata {
  /** Datos específicos de envíos de carga (freight). */
  freight?: FreightMetadata;

  /** Datos específicos de transporte de personas (passenger). Requerido si cargoType='passenger'. */
  passenger?: PassengerMetadata;

  /** Campo libre para extensiones específicas de la company. */
  custom?: Record<string, unknown>;
}

export interface FreightMetadata {
  invoiceNumber?: string;
  sealCode?: string;
  customsRef?: string;
  purchaseOrder?: string;
  declaredValue?: number;
  temperatureCelsius?: number; // para refrigerated
  hazmatClass?: string; // para hazardous
}

export interface PassengerMetadata {
  /** Nombre completo del pasajero (ej. nombre del niño en ruta escolar). */
  fullName: string;

  /** Edad (opcional — útil para escolar / pediátrico). */
  age?: number;

  /** Grado escolar o categoría. */
  grade?: string;

  /** Institución destino (colegio, clínica, empresa). */
  school?: string;

  /** Guardián / tutor legal / responsable. */
  guardianName?: string;
  guardianPhone?: string;

  /** Teléfono de emergencia alternativo. */
  emergencyPhone?: string;

  /** Notas médicas (alergias, medicamentos, condiciones). */
  medicalNotes?: string;

  /** URL a foto del pasajero (S3) — útil para identificación por chofer. */
  photoUrl?: string;

  /** Instrucciones de pickup (ej. "Llamar al 555-... antes de llegar"). */
  pickupInstructions?: string;

  /** Instrucciones de drop-off (ej. "Entregar únicamente a persona autorizada"). */
  dropoffInstructions?: string;
}
