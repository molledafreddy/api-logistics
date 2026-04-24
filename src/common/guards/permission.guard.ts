import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../enums/user-role.enum';
import { IUserPayload } from '../interfaces/user-payload.interface';
import { PermissionsCacheService } from '../cache/permissions-cache.service';

/**
 * PermissionGuard — Global (registrado como APP_GUARD)
 *
 * Comportamiento:
 *  - Si el handler/clase está marcado @Public() → permite (no debería llegar
 *    aquí, JwtAuthGuard ya lo cortocircuita, pero defendemos doblemente).
 *  - Si el handler no declara @Permissions(...) → permite (los controladores
 *    que sólo usan @Roles no requieren permiso de plan).
 *  - super_admin siempre pasa.
 *  - Resuelve el plan activo de la empresa del usuario y verifica que TODOS
 *    los permisos requeridos estén en el plan.
 *  - Cachea el set de permisos por empresa en Redis (TTL 5 min) para evitar
 *    hacer 2 queries en cada request.
 *
 * Plan §20.4: orden global → Throttler → JwtAuth → Roles → Permission → Ownership
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    private readonly permissionsCache: PermissionsCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Endpoint público → permitir
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Sin metadata @Permissions() → permitir (sólo aplica donde está declarado)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 3. Validar usuario presente (JwtAuthGuard ya debería haberlo poblado)
    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserPayload | undefined;
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // 4. super_admin bypass
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // 5. Resolver companyId
    const companyId = user.companyId;
    if (!companyId) {
      throw new ForbiddenException('Usuario sin empresa asignada');
    }

    // 6. Cargar permisos efectivos (con cache Redis)
    const effective = await this.permissionsCache.getOrLoad(companyId, () =>
      this.loadEffectivePermissions(companyId),
    );

    // 7. Validar AND de permisos requeridos
    const missing = requiredPermissions.filter((p) => !effective.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Tu plan no incluye los siguientes permisos: ${missing.join(', ')}`,
      );
    }
    return true;
  }

  /**
   * Carga los códigos de permisos del plan activo de la empresa.
   * Devuelve [] si no hay suscripción activa o el plan no tiene permisos.
   */
  private async loadEffectivePermissions(companyId: string): Promise<string[]> {
    try {
      const rows: Array<{ code: string }> = await this.dataSource.query(
        `
        SELECT pd.code
        FROM subscriptions s
        JOIN plan_permissions pp ON pp.plan_id = s.plan_id
        JOIN permission_definitions pd ON pd.id = pp.permission_id
        WHERE s.company_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC
        `,
        [companyId],
      );
      return Array.from(new Set(rows.map((r) => r.code)));
    } catch (err) {
      this.logger.error(
        `Error cargando permisos para company=${companyId}: ${(err as Error).message}`,
      );
      return [];
    }
  }
}
