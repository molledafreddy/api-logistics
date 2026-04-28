import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { PermissionDefinition } from './entities/permission-definition.entity';
import { PlanPermission } from './entities/plan-permission.entity';

import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PermissionsCacheService } from '../../common/cache/permissions-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, PermissionDefinition, PlanPermission]),
    // CacheModule y PermissionsCacheService son globales (CommonModule)
  ],
  providers: [
    PlansService,
    ...(process.env.SKIP_BULL_SETUP === 'true'
      ? [
          {
            provide: PermissionsCacheService,
            useValue: {
              // eslint-disable-next-line @typescript-eslint/require-await
              async get() {
                return undefined;
              },
              // eslint-disable-next-line @typescript-eslint/require-await
              async set() {
                return undefined;
              },
              // eslint-disable-next-line @typescript-eslint/require-await
              async del() {
                return undefined;
              },
              // eslint-disable-next-line @typescript-eslint/require-await
              async reset() {
                return undefined;
              },
            },
          },
        ]
      : []),
  ],
  controllers: [PlansController],
  exports: [PlansService],
})
export class PlansModule {}
