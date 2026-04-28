import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { Company } from '../modules/companies/entities/company.entity';
import { ServiceTypeGuard } from './guards/service-type.guard';
import { BusinessModelGuard } from './guards/business-model.guard';
import { PermissionsCacheService } from './cache/permissions-cache.service';

/**
 * CommonModule — Global
 *
 * Expone:
 *  - Guards multi-vertical (ServiceTypeGuard, BusinessModelGuard) que leen
 *    Company.serviceType / Company.businessModel.
 *  - Cache Redis global (cache-manager) compartido por toda la app.
 *  - PermissionsCacheService global, consumido por el PermissionGuard
 *    (registrado como APP_GUARD) y por el PlansService al invalidar.
 *
 * Marcado `@Global()` para evitar imports manuales en cada feature module.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Company]),
    ...(process.env.SKIP_BULL_SETUP !== 'true'
      ? [
          CacheModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            isGlobal: true,
            useFactory: async (config: ConfigService) => {
              const host = config.get<string>('REDIS_HOST', 'localhost');
              const port = config.get<number>('REDIS_PORT', 6379);
              const password =
                config.get<string>('REDIS_PASSWORD', '') || undefined;
              const useTls = config.get<string>('REDIS_TLS') === 'true';
              return {
                store: await redisStore({
                  socket: { host, port, ...(useTls ? { tls: true } : {}) },
                  password,
                  ttl: 5 * 60 * 1000, // 5 min default (ms)
                }),
              };
            },
          }),
        ]
      : []),
  ],
  providers: [ServiceTypeGuard, BusinessModelGuard, PermissionsCacheService],
  exports: [
    ServiceTypeGuard,
    BusinessModelGuard,
    PermissionsCacheService,
    CacheModule,
  ],
})
export class CommonModule {}
