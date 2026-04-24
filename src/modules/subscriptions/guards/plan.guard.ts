import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_KEY } from '../decorators/plan.decorator';

@Injectable()
export class PlanGuard implements CanActivate {
  private readonly logger = new Logger(PlanGuard.name);
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    this.logger.debug(`[PlanGuard] requiredPlan: ${requiredPlan}`);
    if (!requiredPlan) {
      this.logger.debug('[PlanGuard] No required plan, access granted');
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    this.logger.debug(`[PlanGuard] user: ${JSON.stringify(user)}`);
    // Suponiendo que el plan del usuario está en user.plan (ajustar según tu modelo)
    if (!user || !user.plan) {
      this.logger.warn('[PlanGuard] No plan information found in user');
      throw new ForbiddenException('No plan information found');
    }
    if (user.plan !== requiredPlan) {
      this.logger.warn(
        `[PlanGuard] User plan (${user.plan}) does not match required plan (${requiredPlan})`,
      );
      throw new ForbiddenException(`Requires plan: ${requiredPlan}`);
    }
    this.logger.debug('[PlanGuard] Access granted');
    return true;
  }
}
