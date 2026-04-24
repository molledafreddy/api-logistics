import { SetMetadata } from '@nestjs/common';
import { BusinessModel } from '../enums/business-model.enum';

export const BUSINESS_MODEL_KEY = 'requiredBusinessModel';

/**
 * Restringe un endpoint/controlador a empresas con uno de los `BusinessModel` dados.
 *
 * Útil para gating de features avanzadas (ej. API pública, SSO, auditoría enterprise).
 * `super_admin` siempre pasa.
 *
 * @example
 * ```ts
 * @Get('enterprise-analytics')
 * @RequireBusinessModel(BusinessModel.ENTERPRISE)
 * getAnalytics(...) { ... }
 * ```
 */
export const RequireBusinessModel = (...models: BusinessModel[]) =>
  SetMetadata(BUSINESS_MODEL_KEY, models);
