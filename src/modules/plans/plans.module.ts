import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';

import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PermissionsCacheService } from './permissions-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, PermissionDefinition, PlanPermission]),
    CacheModule.register(),
  ],
  providers: [PlansService, PermissionGuard, PermissionsCacheService],
  controllers: [PlansController],
  exports: [PlansService, PermissionGuard, PermissionsCacheService],
})
export class PlansModule {}
