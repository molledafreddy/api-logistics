import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  ValidationPipe,
  VersioningType,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  GlobalExceptionFilter,
  TypeormExceptionFilter,
} from './common/filters/index';
import {
  ResponseTransformInterceptor,
  LoggingInterceptor,
  TimeoutInterceptor,
  EmptyStringToUndefinedInterceptor,
} from './common/interceptors/index';
import { TrimStringPipe } from './common/pipes/index';
import { initSentry } from './common/sentry/sentry.init';

async function bootstrap() {
  // ─── Sentry (debe inicializarse ANTES del NestFactory) ───
  initSentry({
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1',
    ),
    profilesSampleRate: parseFloat(
      process.env.SENTRY_PROFILES_SAMPLE_RATE || '0',
    ),
    enabled: !!process.env.SENTRY_DSN,
  });

  // ─── Crear aplicación ──────────────────
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('APP_PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'v1');
  const nodeEnv = configService.get<string>('NODE_ENV');
  const isProd = nodeEnv === 'production';
  const bodySizeLimit = configService.get<string>(
    'MAX_REQUEST_BODY_SIZE',
    '1mb',
  );

  // ─── Trust proxy (necesario tras LB / Nginx para X-Forwarded-* y rate-limit por IP) ───
  app.set('trust proxy', 1);

  // ─── Static assets (cliente WS de pruebas, etc.) ───
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/public/' });

  // ─── Límites de tamaño de payload ─────
  app.use(json({ limit: bodySizeLimit }));
  app.use(urlencoded({ extended: true, limit: bodySizeLimit }));

  // ─── Seguridad: cabeceras (Helmet) ────
  app.use(
    helmet({
      // En dev desactivamos CSP para que el ws-tester pueda cargar socket.io desde CDN
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
      // HSTS estricto sólo en producción (1 año + subdominios + preload)
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      noSniff: true,
    }),
  );

  // ─── Seguridad: HTTP Parameter Pollution ───
  app.use(hpp());

  // ─── Compresión ────────────────────────
  app.use(compression());

  // ─── CORS (default-deny) ──────────────
  const corsOrigins = (configService.get<string>('CORS_ORIGINS', '') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      // Requests sin Origin (curl, healthcheck interno) → permitido
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      logger.warn(`CORS bloqueado para origin=${origin}`);
      return cb(new Error('Origin no permitido por CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  });

  // ─── Prefijo global ───────────────────
  app.setGlobalPrefix(apiPrefix);

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
  // EmptyStringToUndefinedInterceptor debe ir ANTES de la validación de DTOs
  // (Nest ejecuta interceptores antes que pipes en el ciclo de request).
  app.useGlobalInterceptors(
    new EmptyStringToUndefinedInterceptor(),
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // ─── Swagger / OpenAPI ─────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const wsDocs = [
      '## 🔌 WebSockets (Socket.IO)',
      '',
      'Además de los endpoints REST, la API expone tres namespaces en tiempo real.',
      '',
      `**Cliente de pruebas interactivo:** [\`/public/ws-tester.html\`](/public/ws-tester.html)`,
      '',
      '### Conexión',
      '```js',
      `import { io } from 'socket.io-client';`,
      `const socket = io('http://localhost:3000/chat', {`,
      `  auth: { token: '<JWT_SUPABASE>' }, // o headers Authorization: 'Bearer ...'`,
      `  transports: ['websocket'],`,
      `});`,
      '```',
      '',
      '### Namespaces',
      '',
      '#### `/notifications` — push de notificaciones',
      '| Dirección | Evento | Descripción |',
      '|---|---|---|',
      '| ⬅️ Server | `notification:new` | Nueva notificación dirigida al usuario |',
      '| ➡️ Client | `notification:markRead` | Confirmación de lectura |',
      '',
      '_Room automática:_ `user:{userId}` (al conectar).',
      '',
      '#### `/chat` — mensajería',
      '| Dirección | Evento | Payload |',
      '|---|---|---|',
      '| ➡️ Client | `chat:join` | `{ conversationId }` — valida acceso y une al room |',
      '| ➡️ Client | `chat:leave` | `{ conversationId }` |',
      '| ➡️ Client | `chat:send` | `{ conversationId, content, type?, fileUrl?, fileName? }` — persiste y difunde |',
      '| ➡️ Client | `chat:typingStart` / `chat:typingStop` | `{ conversationId }` |',
      '| ➡️ Client | `chat:markRead` | `{ conversationId }` |',
      '| ⬅️ Server | `chat:newMessage` | mensaje completo difundido al room |',
      '| ⬅️ Server | `chat:userTyping` | `{ conversationId, userId, typing }` |',
      '| ⬅️ Server | `chat:messageRead` | `{ conversationId, userId, updated }` |',
      '| ⬅️ Server | `chat:userOnline` / `chat:userOffline` | `{ userId }` |',
      '',
      '_Rooms:_ `conv:{conversationId}`, `user:{userId}`.',
      '',
      '#### `/tracking` — ubicaciones GPS en vivo',
      '| Dirección | Evento | Payload |',
      '|---|---|---|',
      '| ➡️ Client | `tracking:subscribe` | `{ shipmentId?, truckId? }` |',
      '| ➡️ Client | `tracking:unsubscribe` | `{ shipmentId?, truckId? }` |',
      '| ➡️ Client | `tracking:location` | `{ shipmentId?, truckId?, lat, lng, speed?, heading? }` (driver app) |',
      '| ⬅️ Server | `tracking:locationUpdate` | punto difundido al room del shipment/truck |',
      '',
      '_Rooms:_ `shipment:{id}`, `truck:{id}`.',
      '',
      '### Auth',
      'Mismo JWT de Supabase del header HTTP. Si falla → el socket se desconecta inmediatamente.',
      '',
      '### Bridge REST ↔ WS',
      'Cualquier creación vía REST (notificación, mensaje, tracking point) **también** se difunde por WS automáticamente vía `EventEmitter2`.',
    ].join('\n');

    const swaggerConfig = new DocumentBuilder()
      .setTitle('API Logistics')
      .setDescription(
        'Plataforma de gestión logística multi-tenant.\n\n' + wsDocs,
      )
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Ingresa tu JWT token',
        in: 'header',
      })
      .addTag('Health', 'Health checks')
      .addTag('Auth', 'Autenticación y sesiones')
      .addTag('Companies', 'Gestión de empresas')
      .addTag('Users (Team)', 'Gestión de usuarios del equipo')
      .addTag('Plans', 'Planes y permisos')
      .addTag('Subscriptions', 'Suscripciones y facturación')
      .addTag('Verifications', 'Verificación KYC de empresas')
      .addTag('Relationships', 'Relaciones cliente-carrier entre empresas')
      .addTag('Trucks', 'Gestión de flota')
      .addTag('Drivers', 'Gestión de conductores')
      .addTag('Routes', 'Gestión de rutas predefinidas')
      .addTag(
        'Shipments',
        'Gestión de envíos (incluye flujo accept/reject cross-company)',
      )
      .addTag('Tracking', 'Tracking GPS en tiempo real')
      .addTag('Expenses', 'Gestión de gastos y reembolsos')
      .addTag('Chat', 'Mensajería y conversaciones')
      .addTag('Notifications', 'Notificaciones')
      .addTag('Files', 'Subida y descarga de archivos (Supabase Storage)')
      .addTag('Audit', 'Logs de auditoría')
      .addTag('Dashboard', 'KPIs y métricas agregadas')
      .addTag('Reports', 'Reportes y exportaciones (JSON/CSV)')
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
  logger.log(
    `🚀 API Logistics running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  logger.log(`🔌 WS Tester:  http://localhost:${port}/public/ws-tester.html`);
}

bootstrap();
