import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_LIMIT_KEY } from '../decorators/plan-limit.decorator.js';

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

    // TODO: Implement plan limit check
    return true;
  }
}
