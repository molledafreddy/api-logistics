import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';
import { PlanLimit } from './entities/plan-limit.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreatePermissionDefinitionDto } from './dto/create-permission-definition.dto';
import { UpdatePermissionDefinitionDto } from './dto/update-permission-definition.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { CreatePlanLimitDto } from './dto/create-plan-limit.dto';
import { UpdatePlanLimitDto } from './dto/update-plan-limit.dto';
import { PermissionsCacheService } from '../../common/cache/permissions-cache.service';
import type { PlanLimitsMap } from './interfaces/plan-limits-map.interface';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(PermissionDefinition)
    private readonly permissionDefinitionRepository: Repository<PermissionDefinition>,
    @InjectRepository(PlanPermission)
    private readonly planPermissionRepository: Repository<PlanPermission>,
    @InjectRepository(PlanLimit)
    private readonly planLimitRepository: Repository<PlanLimit>,
    @Inject(PermissionsCacheService)
    private readonly permissionsCacheService: PermissionsCacheService,
  ) {}

  // --- Planes ---
  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    this.logger.debug(`[createPlan] dto: ${JSON.stringify(dto)}`);
    return this.planRepository.save(dto);
  }

  async findAllPlans(): Promise<Plan[]> {
    this.logger.debug(`[findAllPlans] llamada`);
    return this.planRepository.find({ where: { is_active: true } });
  }

  async findOnePlan(id: string): Promise<Plan> {
    this.logger.debug(`[findOnePlan] id: ${id}`);
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<Plan> {
    this.logger.debug(`[updatePlan] id: ${id}, dto: ${JSON.stringify(dto)}`);
    await this.planRepository.update(id, dto);
    return this.findOnePlan(id);
  }

  async removePlan(id: string): Promise<{ deleted: boolean }> {
    this.logger.debug(`[removePlan] id: ${id}`);
    const result = await this.planRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Plan not found');
    return { deleted: true };
  }

  // --- Permission Definitions ---
  async createPermission(
    dto: CreatePermissionDefinitionDto,
  ): Promise<PermissionDefinition> {
    this.logger.debug(`[createPermission] dto: ${JSON.stringify(dto)}`);
    return this.permissionDefinitionRepository.save(dto);
  }

  async findAllPermissions(): Promise<PermissionDefinition[]> {
    this.logger.debug(`[findAllPermissions] llamada`);
    return this.permissionDefinitionRepository.find();
  }

  async findOnePermission(id: string): Promise<PermissionDefinition> {
    this.logger.debug(`[findOnePermission] id: ${id}`);
    const perm = await this.permissionDefinitionRepository.findOne({
      where: { id },
    });
    if (!perm) throw new NotFoundException('Permission not found');
    return perm;
  }

  async updatePermission(
    id: string,
    dto: UpdatePermissionDefinitionDto,
  ): Promise<PermissionDefinition> {
    this.logger.debug(
      `[updatePermission] id: ${id}, dto: ${JSON.stringify(dto)}`,
    );
    await this.permissionDefinitionRepository.update(id, dto);
    return this.findOnePermission(id);
  }

  async removePermission(id: string): Promise<{ deleted: boolean }> {
    this.logger.debug(`[removePermission] id: ${id}`);
    const result = await this.permissionDefinitionRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Permission not found');
    return { deleted: true };
  }

  // --- Asignar Permiso a Plan ---
  async assignPermissionToPlan(
    dto: AssignPermissionDto,
  ): Promise<PlanPermission> {
    this.logger.debug(`[assignPermissionToPlan] dto: ${JSON.stringify(dto)}`);
    const plan = await this.planRepository.findOne({
      where: { id: dto.planId },
    });
    const permission = await this.permissionDefinitionRepository.findOne({
      where: { id: dto.permissionId },
    });
    if (!plan || !permission)
      throw new NotFoundException('Plan or Permission not found');
    const planPermission = this.planPermissionRepository.create({
      plan,
      permission,
    });
    const saved = await this.planPermissionRepository.save(planPermission);
    // Invalidar cache de permisos para la empresa/plan afectado
    await this.permissionsCacheService.invalidatePermissionsCache(dto.planId);
    return saved;
  }

  /**
   * Obtiene los permisos efectivos de una empresa, usando cache Redis.
   */
  async getEffectivePermissions(companyId: string): Promise<string[]> {
    this.logger.debug(`[getEffectivePermissions] companyId: ${companyId}`);
    // 1. Intenta obtener del cache
    const cached =
      await this.permissionsCacheService.getPermissionsCache(companyId);
    if (cached) return cached;

    // 2. Buscar la suscripción activa de la empresa y los permisos del plan
    // Usar query similar a PermissionGuard
    const entityManager = this.planRepository.manager;
    const rows: Array<{ code: string }> = await entityManager.query(
      `
      SELECT pd.code
        FROM (
          SELECT plan_id FROM subscriptions
           WHERE company_id = $1 AND status = 'active'
           ORDER BY created_at DESC
           LIMIT 1
        ) s
        JOIN plan_permissions pp ON pp.plan_id = s.plan_id
        JOIN permission_definitions pd ON pd.id = pp.permission_id
      `,
      [companyId],
    );
    const permissions = Array.from(new Set(rows.map((r) => r.code)));
    // 3. Guarda en cache
    await this.permissionsCacheService.setPermissionsCache(
      companyId,
      permissions,
    );
    return permissions;
  }

  // --- Límites de Plan ---
  async createPlanLimit(
    planId: string,
    dto: CreatePlanLimitDto,
  ): Promise<PlanLimit> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const planLimit = this.planLimitRepository.create({
      plan,
      planId,
      vertical: dto.vertical,
      code: dto.code,
      value: dto.value,
    });
    const saved = await this.planLimitRepository.save(planLimit);
    await this.syncPlanLimitsJsonb(planId);
    return saved;
  }

  async findPlanLimits(planId: string): Promise<PlanLimit[]> {
    return this.planLimitRepository.find({
      where: { planId },
    });
  }

  async updatePlanLimit(
    id: string,
    dto: UpdatePlanLimitDto,
  ): Promise<PlanLimit> {
    const planLimit = await this.planLimitRepository.findOne({ where: { id } });
    if (!planLimit) throw new NotFoundException('PlanLimit not found');
    Object.assign(planLimit, dto);
    const saved = await this.planLimitRepository.save(planLimit);
    await this.syncPlanLimitsJsonb(saved.planId);
    return saved;
  }

  async removePlanLimit(id: string): Promise<{ deleted: boolean }> {
    const planLimit = await this.planLimitRepository.findOne({ where: { id } });
    if (!planLimit) throw new NotFoundException('PlanLimit not found');
    const planId = planLimit.planId;
    await this.planLimitRepository.delete(id);
    await this.syncPlanLimitsJsonb(planId);
    return { deleted: true };
  }

  // ────────────────────────────────────────────────────────────────
  // Sprint A — Catálogo verticalizado + límites jsonb materializados
  // ────────────────────────────────────────────────────────────────

  /**
   * Hook de sincronización HÍBRIDA: la tabla `plan_limits` es la fuente de
   * verdad (auditable, CRUD admin) y `plans.limits` (jsonb) es la
   * materialización para lecturas O(1) en guards (p.ej. OptimizationLimitsGuard).
   *
   * Se invoca desde createPlanLimit / updatePlanLimit / removePlanLimit.
   */
  async syncPlanLimitsJsonb(planId: string): Promise<PlanLimitsMap> {
    this.logger.debug(`[syncPlanLimitsJsonb] planId: ${planId}`);
    const rows = await this.planLimitRepository.find({ where: { planId } });
    const map: PlanLimitsMap = {};
    for (const r of rows) {
      if (!map[r.vertical]) map[r.vertical] = {};
      map[r.vertical]![r.code] = Number(r.value);
    }
    await this.planRepository.update(planId, { limits: map });
    return map;
  }

  /**
   * Catálogo público de planes activos, ideal para landing/onboarding.
   * Devuelve sólo planes con `code` definido (es decir, planes "del nuevo
   * mundo" Sprint A; los legacy con `code IS NULL` quedan ocultos).
   */
  async getCatalog(): Promise<Plan[]> {
    this.logger.debug(`[getCatalog] llamada`);
    return this.planRepository
      .createQueryBuilder('p')
      .where('p.is_active = true')
      .andWhere('p.code IS NOT NULL')
      .orderBy('p.audience', 'ASC')
      .addOrderBy('p.price', 'ASC')
      .getMany();
  }

  /**
   * Actualiza únicamente el precio de un plan (super_admin).
   */
  async updatePrice(id: string, price: number): Promise<Plan> {
    this.logger.debug(`[updatePrice] id: ${id}, price: ${price}`);
    if (price < 0) {
      throw new NotFoundException('price debe ser ≥ 0');
    }
    await this.planRepository.update(id, { price });
    return this.findOnePlan(id);
  }

  /**
   * Reemplaza el jsonb `limits` de un plan completo (super_admin).
   * NOTA: este método NO toca la tabla `plan_limits`. Si querés mantener la
   * coherencia híbrida, usá los endpoints de PlanLimit (CRUD por vertical+code).
   */
  async updatePlanLimits(id: string, limits: PlanLimitsMap): Promise<Plan> {
    this.logger.debug(
      `[updatePlanLimits] id: ${id}, limits: ${JSON.stringify(limits)}`,
    );
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) {
      throw new NotFoundException('limits debe ser un objeto PlanLimitsMap');
    }
    await this.planRepository.update(id, { limits });
    return this.findOnePlan(id);
  }

  /**
   * Devuelve los límites efectivos del plan activo de una empresa.
   * Si la empresa no tiene suscripción activa devuelve `{}` (sin límites
   * configurados → caller decide si denegar o aplicar default).
   */
  async getEffectiveLimits(companyId: string): Promise<PlanLimitsMap> {
    this.logger.debug(`[getEffectiveLimits] companyId: ${companyId}`);
    const rows: Array<{ limits: PlanLimitsMap }> =
      await this.planRepository.manager.query(
        `
        SELECT p.limits
          FROM subscriptions s
          JOIN plans p ON p.id = s.plan_id
         WHERE s.company_id = $1 AND s.status = 'active'
         ORDER BY s.created_at DESC
         LIMIT 1
        `,
        [companyId],
      );
    return rows[0]?.limits ?? {};
  }
}
