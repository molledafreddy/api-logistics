import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_FEATURE_KEY } from '../decorators/plan-feature.decorator';

/**
 * Plan Feature Guard — Stub for Fase 0
 * Full implementation in Fase 2 (Plans/Subscriptions)
 */
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const company = user?.company;
    if (!company) {
      // Si no hay empresa asociada, denegar
      return false;
    }

    // company.planFeatures = ['api', 'advanced_reports', ...]
    const planFeatures: string[] = company.planFeatures || [];
    if (planFeatures.includes(requiredFeature)) {
      return true;
    }
    throw new ForbiddenException(
      `Feature de plan no habilitada: ${requiredFeature}`,
    );
  }
}
