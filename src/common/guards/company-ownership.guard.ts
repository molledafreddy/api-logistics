import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IUserPayload } from '../interfaces/user-payload.interface';
import { UserRole } from '../enums/user-role.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * CompanyOwnershipGuard — Global (registrado como APP_GUARD)
 *
 * Defensa en profundidad multi-tenant: verifica que el usuario autenticado
 * pertenezca a la empresa referenciada en la request.
 *
 * Se activa solo si la request trae un `companyId` explícito en:
 *   1. Route param :companyId
 *   2. Body { companyId }
 *   3. Query ?companyId=
 *
 * Casos de bypass (return true):
 *   - Endpoint @Public()
 *   - Sin user en la request (lo maneja JwtAuthGuard)
 *   - super_admin
 *   - Sin companyId explícito (el service debe filtrar por user.companyId)
 *
 * Plan §20.4 — guard #7 en el pipeline.
 */
@Injectable()
export class CompanyOwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserPayload | undefined;

    if (!user) return true;
    if (user.role === UserRole.SUPER_ADMIN) return true;

    const targetCompanyId =
      request.params?.companyId ||
      request.body?.companyId ||
      request.query?.companyId ||
      null;

    if (!targetCompanyId) return true;

    if (!user.companyId) {
      throw new ForbiddenException('No perteneces a ninguna empresa');
    }
    if (user.companyId !== targetCompanyId) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }
    return true;
  }
}
