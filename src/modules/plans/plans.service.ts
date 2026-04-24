import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreatePermissionDefinitionDto } from './dto/create-permission-definition.dto';
import { UpdatePermissionDefinitionDto } from './dto/update-permission-definition.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { PermissionsCacheService } from './permissions-cache.service';

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
    @Inject(PermissionsCacheService)
    private readonly permissionsCacheService: PermissionsCacheService,
  ) {}

  // --- Planes ---
  async createPlan(dto: CreatePlanDto) {
    this.logger.debug(`[createPlan] dto: ${JSON.stringify(dto)}`);
    console.log('[PLANS_SERVICE] Antes de planRepository.save');
    const result = await this.planRepository.save(dto);
    console.log('[PLANS_SERVICE] Resultado de planRepository.save', result);
    return result;
  }

  async findAllPlans() {
    this.logger.debug(`[findAllPlans] llamada`);
    console.log('[PLANS_SERVICE] Antes de planRepository.find');
    const result = await this.planRepository.find();
    console.log('[PLANS_SERVICE] Resultado de planRepository.find', result);
    return result;
  }

  async findOnePlan(id: string) {
    this.logger.debug(`[findOnePlan] id: ${id}`);
    console.log('[PLANS_SERVICE] Antes de planRepository.findOne');
    const plan = await this.planRepository.findOne({ where: { id } });
    console.log('[PLANS_SERVICE] Resultado de planRepository.findOne', plan);
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    this.logger.debug(`[updatePlan] id: ${id}, dto: ${JSON.stringify(dto)}`);
    await this.planRepository.update(id, dto);
    return this.findOnePlan(id);
  }

  async removePlan(id: string) {
    this.logger.debug(`[removePlan] id: ${id}`);
    const result = await this.planRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Plan not found');
    return { deleted: true };
  }

  // --- Permission Definitions ---
  async createPermission(dto: CreatePermissionDefinitionDto) {
    this.logger.debug(`[createPermission] dto: ${JSON.stringify(dto)}`);
    return this.permissionDefinitionRepository.save(dto);
  }

  async findAllPermissions() {
    this.logger.debug(`[findAllPermissions] llamada`);
    return this.permissionDefinitionRepository.find();
  }

  async findOnePermission(id: string) {
    this.logger.debug(`[findOnePermission] id: ${id}`);
    const perm = await this.permissionDefinitionRepository.findOne({
      where: { id },
    });
    if (!perm) throw new NotFoundException('Permission not found');
    return perm;
  }

  async updatePermission(id: string, dto: UpdatePermissionDefinitionDto) {
    this.logger.debug(
      `[updatePermission] id: ${id}, dto: ${JSON.stringify(dto)}`,
    );
    await this.permissionDefinitionRepository.update(id, dto);
    return this.findOnePermission(id);
  }

  async removePermission(id: string) {
    this.logger.debug(`[removePermission] id: ${id}`);
    const result = await this.permissionDefinitionRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Permission not found');
    return { deleted: true };
  }

  // --- Asignar Permiso a Plan ---
  async assignPermissionToPlan(dto: AssignPermissionDto) {
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
    // 2. Si no hay cache, calcula los permisos
    const plan = await this.planRepository.findOne({
      where: { id: companyId },
      relations: ['planPermissions', 'planPermissions.permission'],
    });
    if (!plan) return [];
    // Suponiendo que plan.planPermissions existe y tiene la relación
    const permissions =
      (plan as any).planPermissions?.map((pp: any) => pp.permission.code) || [];
    // 3. Guarda en cache
    await this.permissionsCacheService.setPermissionsCache(
      companyId,
      permissions,
    );
    return permissions;
  }
}
