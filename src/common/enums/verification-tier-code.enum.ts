/**
 * Códigos canónicos de los `verification_tiers` del sistema.
 *
 * Se usan tanto en seeds como en el `ComplianceService` para resolver
 * el tier que aplica a una empresa (en particular `PASSENGER_SAFE` para MV-002).
 *
 * Si se añaden nuevos tiers en BD, sumarlos también aquí.
 */
export enum VerificationTierCode {
  UNVERIFIED = 'unverified',
  BASIC = 'basic',
  VERIFIED = 'verified',
  PREMIUM = 'premium',
  /** PARTE 7 · Sprint 6 — requerido para operar serviceType=passenger (MV-002). */
  PASSENGER_SAFE = 'passenger_safe',
}
