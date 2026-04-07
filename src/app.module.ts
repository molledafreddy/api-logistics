import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

// Config
import { validationSchema } from './config/validation.schema.js';
import { appConfig } from './config/app.config.js';
import { databaseConfig } from './config/database.config.js';
import { redisConfig } from './config/redis.config.js';
import { jwtConfig } from './config/jwt.config.js';
import { s3Config } from './config/s3.config.js';
import { mailConfig } from './config/mail.config.js';
import { stripeConfig } from './config/stripe.config.js';
import { throttleConfig } from './config/throttle.config.js';

// Core modules
import { DatabaseModule } from './database/database.module.js';

// Controllers
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    // ─── Configuración ─────────
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
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
      ],
    }),

    // ─── Base de datos ─────────
    DatabaseModule,

    // ─── Rate Limiting ─────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // ─── Event Emitter ─────────
    EventEmitterModule.forRoot(),

    // ─── Scheduler (Cron) ──────
    ScheduleModule.forRoot(),

    // ─── Business Modules (se agregan en fases posteriores) ──
  ],
  controllers: [HealthController],
  providers: [
    // Guard global de throttle
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
