import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reflector } from '@nestjs/core';
import {
  PLAN_LIMITS_GLOBAL_VERTICAL,
  PlanLimitsMap,
} from '../plans/interfaces/plan-limits-map.interface';
import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { OptimizationReoptCacheService } from './optimization-reopt-cache.service';

/**
 * OptimizationLimitsGuard — Sprint B
 * Enforce maxStopsPerOptimization y maxReoptimizationsPerDay según el plan de la empresa.
 */
@Injectable()
export class OptimizationLimitsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(DeliveryRun)
    private readonly runRepo: Repository<DeliveryRun>,
    private readonly reoptCache: OptimizationReoptCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = user?.companyId;
    if (!companyId) throw new ForbiddenException('No companyId in user');

    // Cargar la subscripción activa y su plan
    const subscription = await this.subscriptionRepo.findOne({
      where: { company_id: companyId, status: 'active' },
      order: { created_at: 'DESC' },
    });
    if (!subscription)
      throw new ForbiddenException('No active subscription found for company');
    const plan = await this.planRepo.findOne({
      where: { id: subscription.plan_id },
    });
    if (!plan) throw new ForbiddenException('Plan not found');
    const limits: PlanLimitsMap = plan.limits || {};
    const globalLimits = limits[PLAN_LIMITS_GLOBAL_VERTICAL] || {};

    // 1. Limitar stops por optimización
    if (
      request.body?.stops &&
      globalLimits.maxStopsPerOptimization !== undefined
    ) {
      if (request.body.stops.length > globalLimits.maxStopsPerOptimization) {
        throw new ForbiddenException(
          `El plan solo permite hasta ${globalLimits.maxStopsPerOptimization} paradas por optimización.`,
        );
      }
    }

    // 2. Limitar reoptimizaciones por día usando Redis
    if (globalLimits.maxReoptimizationsPerDay !== undefined) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const reoptCount = await this.reoptCache.get(companyId, today);
      if (reoptCount >= globalLimits.maxReoptimizationsPerDay) {
        throw new ForbiddenException(
          `El plan solo permite ${globalLimits.maxReoptimizationsPerDay} reoptimizaciones por día.`,
        );
      }
      // Incrementar el contador para este intento
      await this.reoptCache.incr(companyId, today);
    }

    return true;
  }
}
