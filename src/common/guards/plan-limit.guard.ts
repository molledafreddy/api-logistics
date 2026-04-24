import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_LIMIT_KEY } from '../decorators/plan-limit.decorator';

/**
 * Plan Limit Guard — Stub for Fase 0
 * Full implementation in Fase 2 (Plans/Subscriptions)
 */
@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredResource = this.reflector.getAllAndOverride<string>(
      PLAN_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredResource) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const company = user?.company;
    if (!company) {
      // Si no hay empresa asociada, denegar
      return false;
    }

    // Ejemplo: company.planLimits = { max_trucks: 10, max_drivers: 5 }
    //          company.usage = { max_trucks: 8, max_drivers: 5 }
    const planLimits = company.planLimits || {};
    const usage = company.usage || {};
    const maxAllowed = planLimits[requiredResource];
    const currentUsage = usage[requiredResource] || 0;

    // Si el límite es -1 (ilimitado) o no está definido, permitir
    if (maxAllowed === undefined || maxAllowed === -1) {
      return true;
    }
    // Permitir si el uso actual es menor al máximo permitido
    if (currentUsage < maxAllowed) {
      return true;
    }
    // Si se alcanza el límite, denegar
    throw new ForbiddenException(
      `Límite de plan alcanzado para ${requiredResource}`,
    );
  }
}
