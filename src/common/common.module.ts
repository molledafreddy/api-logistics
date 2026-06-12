import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { Company } from '../modules/companies/entities/company.entity';
import { getRedisConnection } from '../config/redis-connection.helper';
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

const skipRedis =
  process.env.SKIP_BULL_SETUP === 'true' ||
  process.env.NODE_ENV === 'test' ||
  !process.env.REDIS_URL;

const permissionsCacheProvider = skipRedis
  ? {
      provide: PermissionsCacheService,
      useValue: {
        async get() {
          return undefined;
        },
        async set() {
          return undefined;
        },
        async del() {
          return undefined;
        },
        async reset() {
          return undefined;
        },
        async getOrLoad(_companyId: string, loader: () => Promise<string[]>) {
          return loader();
        },
        async invalidate() {
          return undefined;
        },
      },
    }
  : PermissionsCacheService;

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Company]),
    ...(!skipRedis
      ? [
          CacheModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            isGlobal: true,
            useFactory: async (_config: ConfigService) => {
              const { host, port, password } = getRedisConnection();
              // node-redis connect() can hang forever without rejecting on certain
              // connectivity/TLS failures — wrap with a hard timeout so bootstrap
              // always completes and falls back to in-memory cache.
              const timeout = new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error('Redis connect timeout (8s)')),
                  8_000,
                ),
              );
              try {
                const store = await Promise.race([
                  redisStore({
                    socket: {
                      host,
                      port,
                      tls:
                        !host.includes('railway.internal') &&
                        process.env.REDIS_TLS === 'true',
                      connectTimeout: 5_000,
                      reconnectStrategy: (retries: number) => {
                        if (retries >= 3)
                          return new Error(
                            'Redis unreachable after 3 attempts',
                          );
                        return Math.min(retries * 300, 1_000);
                      },
                    },
                    password: password || undefined,
                    ttl: 5 * 60 * 1_000,
                  }),
                  timeout,
                ]);
                return { store };
              } catch (err) {
                console.warn(
                  '[CacheModule] Redis unavailable, falling back to in-memory cache:',
                  (err as Error).message,
                );
                return {};
              }
            },
          }),
        ]
      : []),
  ],
  providers: [ServiceTypeGuard, BusinessModelGuard, permissionsCacheProvider],
  exports: [
    ServiceTypeGuard,
    BusinessModelGuard,
    PermissionsCacheService,
    ...(skipRedis ? [] : [CacheModule]),
  ],
})
export class CommonModule {}
