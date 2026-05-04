import { Module } from '@nestjs/common';
import { PermissionsCacheService } from './common/cache/permissions-cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

// Config
import { validationSchema } from './config/validation.schema';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { jwtConfig } from './config/jwt.config';
import { s3Config } from './config/s3.config';
import { mailConfig } from './config/mail.config';
import { stripeConfig } from './config/stripe.config';
import { throttleConfig } from './config/throttle.config';
import { supabaseConfig } from './config/supabase.config';
import { sentryConfig } from './config/sentry.config';

// Core modules
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { VerificationsModule } from './modules/verifications/verifications.module';
import { RelationshipsModule } from './modules/relationships/relationships.module';
import { FilesModule } from './modules/files/files.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { TrucksModule } from './modules/trucks/trucks.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ChatModule } from './modules/chat/chat.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DeliveryRunsModule } from './modules/delivery-runs/delivery-runs.module';
import { RecurringTemplatesModule } from './modules/recurring-templates/recurring-templates.module';
import { OptimizationModule } from './modules/optimization/optimization.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { SavedAddressesModule } from './modules/saved-addresses/saved-addresses.module';
import { PaymentsModule } from './modules/payments/payments.module';

// Gateways (WebSockets)
import { GatewaysModule } from './gateways/gateways.module';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { CompanyOwnershipGuard } from './common/guards/company-ownership.guard';

// Controllers
import { HealthController } from './health.controller';
import { RootController } from './root.controller';

// Middleware
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    // ─── Configuración ─────────
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: {
        abortEarly: false, // reporta TODOS los env vars inválidos (no solo el primero)
        allowUnknown: true, // permite variables extra (CI, OS, etc.) sin romper
      },
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        s3Config,
        mailConfig,
        stripeConfig,
        throttleConfig,
        supabaseConfig,
        sentryConfig,
      ],
    }),

    // ─── Base de datos ─────────
    DatabaseModule,

    // ─── Common (global) ───────
    CommonModule,

    // ─── Rate Limiting (multi-bucket) ─────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: config.get<number>('THROTTLE_SHORT_TTL', 1000),
            limit: config.get<number>('THROTTLE_SHORT_LIMIT', 10),
          },
          {
            name: 'medium',
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
          {
            name: 'long',
            ttl: config.get<number>('THROTTLE_LONG_TTL', 3600000),
            limit: config.get<number>('THROTTLE_LONG_LIMIT', 1000),
          },
        ],
      }),
    }),

    // ─── Event Emitter ─────────
    EventEmitterModule.forRoot(),

    // ─── Scheduler (Cron) ──────
    ScheduleModule.forRoot(),

    // ─── Business Modules ────────────────────
    AuthModule,
    CompaniesModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
    VerificationsModule,
    RelationshipsModule,
    FilesModule,
    AuditModule,
    NotificationsModule,
    AdminModule,
    TrucksModule,
    DriversModule,
    RoutesModule,
    ShipmentsModule,
    TrackingModule,
    ExpensesModule,
    ChatModule,
    DashboardModule,
    ReportsModule,
    DeliveryRunsModule,
    RecurringTemplatesModule,
    OptimizationModule,
    GeocodingModule,
    SavedAddressesModule,
    PaymentsModule,
    GatewaysModule,
  ],
  controllers: [HealthController, RootController],
  providers: [
    // ─── Guards globales (orden importa, plan §20.4) ───
    // 1. Rate limiting → 2. JWT → 3. Roles → 4. Permission (cache Redis) → 5. Ownership
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: CompanyOwnershipGuard },
    // PermissionsCacheService ya está registrado globalmente en CommonModule (stub o real)
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
