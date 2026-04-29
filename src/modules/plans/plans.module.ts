import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';

import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, PermissionDefinition, PlanPermission]),
    // CacheModule y PermissionsCacheService son globales (CommonModule)
  ],
  providers: [PlansService],
  controllers: [PlansController],
  exports: [PlansService],
})
export class PlansModule {}
