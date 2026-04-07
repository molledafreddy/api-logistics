import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, HttpStatus, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter, TypeormExceptionFilter } from './common/filters/index.js';
import {
  ResponseTransformInterceptor,
  LoggingInterceptor,
  TimeoutInterceptor,
} from './common/interceptors/index.js';
import { TrimStringPipe } from './common/pipes/index.js';

async function bootstrap() {
  // ─── Crear aplicación ──────────────────
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('APP_PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'v1');

  // ─── Seguridad ─────────────────────────
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: (configService.get<string>('CORS_ORIGINS', '') || '')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // ─── Prefijo global ───────────────────
  app.setGlobalPrefix(apiPrefix);

  // ─── Versionado ────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── Pipes globales ────────────────────
  app.useGlobalPipes(
    new TrimStringPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  // ─── Filtros globales ──────────────────
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new TypeormExceptionFilter(),
  );

  // ─── Interceptores globales ────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // ─── Swagger / OpenAPI ─────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API Logistics')
      .setDescription('Plataforma de gestión logística multi-tenant')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Ingresa tu JWT token',
          in: 'header',
        },
        'access-token',
      )
      .addTag('Health', 'Health checks')
      .addTag('Auth', 'Autenticación y sesiones')
      .addTag('Companies', 'Gestión de empresas')
      .addTag('Users', 'Gestión de usuarios')
      .addTag('Subscriptions', 'Suscripciones y facturación')
      .addTag('Trucks', 'Gestión de flota')
      .addTag('Drivers', 'Gestión de conductores')
      .addTag('Shipments', 'Gestión de envíos')
      .addTag('Tracking', 'Tracking en tiempo real')
      .addTag('Expenses', 'Gestión de gastos')
      .addTag('Chat', 'Mensajería')
      .addTag('Notifications', 'Notificaciones')
      .addTag('Dashboard', 'Dashboard y reportes')
      .addTag('Admin', 'Panel de administración')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
      },
    });
  }

  // ─── Graceful shutdown ─────────────────
  app.enableShutdownHooks();

  // ─── Iniciar servidor ──────────────────
  await app.listen(port);
  logger.log(`🚀 API Logistics running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();

