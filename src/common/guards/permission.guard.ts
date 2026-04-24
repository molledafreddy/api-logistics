import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { DataSource } from 'typeorm';
import { PlanPermission } from '../../modules/plans/entities/plan-permission.entity';
import { PermissionDefinition } from '../../modules/plans/entities/permission-definition.entity';
import { Plan } from '../../modules/plans/entities/plan.entity';

/**
 * Permission Guard — Implementación Fase 1
 * Valida que el usuario tenga el permiso requerido según su plan.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // LOG inicio
    console.log('[PERMISSION_GUARD] INICIO canActivate');
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    console.log('[PERMISSION_GUARD] requiredPermissions:', requiredPermissions);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      console.log(
        '[PERMISSION_GUARD] No required permissions, acceso permitido',
      );
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    console.log('[PERMISSION_GUARD] user:', user);
    if (!user) {
      console.log('[PERMISSION_GUARD] No user in request');
      throw new ForbiddenException('No user in request');
    }

    // Resolve planId from the company's active subscription
    let planId = user.planId || user.plan_id || user.plan || null;
    if (!planId && user.companyId) {
      const sub = await this.dataSource.query(
        `SELECT plan_id FROM subscriptions WHERE company_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [user.companyId],
      );
      planId = sub[0]?.plan_id || null;
    }
    console.log('[PERMISSION_GUARD] planId:', planId);
    if (!planId) {
      console.log('[PERMISSION_GUARD] User has no plan assigned');
      throw new ForbiddenException('User has no plan assigned');
    }

    // Obtener los códigos de permisos asociados al plan
    const planPermissions = await this.dataSource
      .getRepository(PlanPermission)
      .createQueryBuilder('pp')
      .leftJoinAndSelect('pp.permission', 'permission')
      .where('pp.plan = :planId', { planId })
      .getMany();
    console.log('[PERMISSION_GUARD] planPermissions:', planPermissions);

    const userPermissionCodes = planPermissions.map((pp) => pp.permission.code);
    console.log('[PERMISSION_GUARD] userPermissionCodes:', userPermissionCodes);

    // Validar que el usuario tenga TODOS los permisos requeridos
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissionCodes.includes(perm),
    );
    console.log('[PERMISSION_GUARD] hasAllPermissions:', hasAllPermissions);
    if (!hasAllPermissions) {
      console.log('[PERMISSION_GUARD] Insufficient permissions for this plan');
      throw new ForbiddenException('Insufficient permissions for this plan');
    }
    console.log('[PERMISSION_GUARD] FIN OK');
    return true;
  }
}
