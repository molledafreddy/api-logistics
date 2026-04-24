import { SetMetadata } from '@nestjs/common';
import { ServiceType } from '../enums/service-type.enum';

export const SERVICE_TYPE_KEY = 'requiredServiceType';

/**
 * Restringe un endpoint/controlador a empresas con uno de los `ServiceType` dados.
 *
 * Funciona en conjunto con `ServiceTypeGuard` (registro en el módulo donde se use).
 * `super_admin` siempre pasa. Si la empresa es `MIXED` pasa para cualquier tipo.
 *
 * @example
 * ```ts
 * @Post('passenger-only-endpoint')
 * @RequireServiceType(ServiceType.PASSENGER)
 * createPassengerRoute(...) { ... }
 * ```
 */
export const RequireServiceType = (...types: ServiceType[]) =>
  SetMetadata(SERVICE_TYPE_KEY, types);
