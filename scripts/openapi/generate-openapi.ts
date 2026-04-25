/**
 * Generates `docs/openapi.json` from the live Nest application,
 * WITHOUT touching Postgres / Redis / S3.
 *
 * Strategy:
 *  - Use @nestjs/testing Test.createTestingModule(AppModule) so we can
 *    override the `DataSource` provider (and getDataSourceToken) with a
 *    fake in-memory stub. This bypasses TypeORM's `initialize()` which
 *    otherwise hangs trying to connect to the DB.
 *  - We DO NOT call `app.init()` nor `app.listen()`, so:
 *      · onModuleInit lifecycle hooks don't fire (no DB queries, no cron starts).
 *      · WebSocket gateways never bind a port.
 *  - SwaggerModule.createDocument only walks the Nest container metadata,
 *    so it works fine without a fully initialized app.
 *
 * Usage:
 *   pnpm openapi:generate
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from '../../src/app.module';

// ─── Stub repository (chainable for QueryBuilder / Manager) ───────────────
function stubChain(): any {
  const chain: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'getMany' || prop === 'getRawMany') return async () => [];
        if (prop === 'getManyAndCount') return async () => [[], 0];
        if (prop === 'getOne' || prop === 'getRawOne') return async () => null;
        if (prop === 'getCount') return async () => 0;
        if (prop === 'execute') return async () => ({});
        if (prop === 'then') return undefined; // not a thenable
        return () => chain; // every method returns the same chainable
      },
    },
  );
  return chain;
}

const stubRepo: any = {
  find: async () => [],
  findOne: async () => null,
  findOneBy: async () => null,
  findOneByOrFail: async () => null,
  findAndCount: async () => [[], 0],
  count: async () => 0,
  save: async (x: any) => x,
  insert: async () => ({ identifiers: [{}] }),
  update: async () => ({ affected: 0 }),
  delete: async () => ({ affected: 0 }),
  softDelete: async () => ({ affected: 0 }),
  remove: async (x: any) => x,
  create: (x: any) => x,
  merge: (a: any, b: any) => ({ ...a, ...b }),
  preload: async (x: any) => x,
  query: async () => [],
  createQueryBuilder: () => stubChain(),
  metadata: { columns: [], relations: [] },
  manager: undefined as any,
};

const stubManager: any = {
  getRepository: () => stubRepo,
  transaction: async (cb: any) => cb(stubManager),
  query: async () => [],
  save: async (x: any) => x,
  find: async () => [],
};
stubRepo.manager = stubManager;

const fakeDataSource: any = {
  isInitialized: true,
  initialize: async () => fakeDataSource,
  destroy: async () => undefined,
  getRepository: () => stubRepo,
  getMongoRepository: () => stubRepo,
  getTreeRepository: () => stubRepo,
  entityMetadatas: [],
  manager: stubManager,
  createQueryBuilder: () => stubChain(),
  createQueryRunner: () => ({
    connect: async () => undefined,
    release: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    manager: stubManager,
  }),
  query: async () => [],
  options: { type: 'postgres', entities: [] },
};

async function generate(): Promise<void> {
  const logger = new Logger('OpenAPI:generate');

  logger.log('Booting AppModule with stubbed DataSource…');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DataSource)
    .useValue(fakeDataSource)
    .overrideProvider(getDataSourceToken())
    .useValue(fakeDataSource)
    .compile();

  // NestApplication wrapper (no init / no listen → no side effects)
  const app = moduleRef.createNestApplication({
    logger: ['error', 'warn'],
  });

  // Replicate main.ts global prefix so paths come out as /api/v1/...
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('API Logistics')
    .setDescription('Plataforma de gestión logística multi-tenant.')
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
      'bearer',
    )
    .addTag('Health')
    .addTag('Auth')
    .addTag('Companies')
    .addTag('Users (Team)')
    .addTag('Plans')
    .addTag('Subscriptions')
    .addTag('Verifications')
    .addTag('Relationships')
    .addTag('Trucks')
    .addTag('Drivers')
    .addTag('Routes')
    .addTag('Shipments')
    .addTag('Tracking')
    .addTag('Expenses')
    .addTag('Chat')
    .addTag('Notifications')
    .addTag('Files')
    .addTag('Audit')
    .addTag('Dashboard')
    .addTag('Reports')
    .addTag('Admin')
    .addTag('Optimization')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ─── Post-process: add common error responses (401/403/404) ───────────
  // Avoids spamming @ApiResponse on every endpoint. Keeps the spec lean and
  // satisfies audit rules (missing-401 / missing-404 / missing-bearer).
  const PUBLIC_PATH_RE = [
    /^\/api\/v1\/health/i,
    /^\/api\/v1\/auth\/register/i,
    /^\/api\/v1\/auth\/login/i,
    /^\/api\/v1\/auth\/refresh/i,
    /^\/api\/v1\/users\/accept-invite/i,
    /^\/api\/v1\/?$/,
    /^\/$/,
  ];
  const isPublicPath = (p: string) => PUBLIC_PATH_RE.some((re) => re.test(p));

  const ERROR_RESPONSES: Record<string, { description: string }> = {
    '401': { description: 'Unauthorized — JWT inválido o ausente' },
    '403': { description: 'Forbidden — sin permisos suficientes' },
    '404': { description: 'Not Found — recurso no existe' },
  };

  let added401 = 0;
  let added404 = 0;
  let addedBearer = 0;

  for (const [pathKey, item] of Object.entries(document.paths || {})) {
    const isParam = /\{[^}]+\}/.test(pathKey);
    const requiresAuth = !isPublicPath(pathKey);

    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = (item as Record<string, any>)[method];
      if (!op) continue;
      op.responses = op.responses || {};

      if (requiresAuth) {
        // Apply bearer security if missing
        if (!Array.isArray(op.security) || op.security.length === 0) {
          op.security = [{ bearer: [] }];
          addedBearer++;
        }
        // 401
        if (!op.responses['401']) {
          op.responses['401'] = ERROR_RESPONSES['401'];
          added401++;
        }
        // 403 (uniform — keeps spec consistent for protected endpoints)
        if (!op.responses['403']) {
          op.responses['403'] = ERROR_RESPONSES['403'];
        }
      }

      // 404 on parametrized non-POST endpoints
      if (isParam && method !== 'post' && !op.responses['404']) {
        op.responses['404'] = ERROR_RESPONSES['404'];
        added404++;
      }
    }
  }

  const outDir = join(process.cwd(), 'docs');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'openapi.json');
  writeFileSync(outFile, JSON.stringify(document, null, 2), 'utf-8');

  const pathCount = Object.keys(document.paths || {}).length;
  let opCount = 0;
  for (const p of Object.values(document.paths || {})) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      if ((p as Record<string, unknown>)[m]) opCount++;
    }
  }
  logger.log(
    `✅ OpenAPI written → ${outFile}  (${pathCount} paths, ${opCount} operations)`,
  );
  logger.log(
    `   Post-process: +${added401} × 401, +${added404} × 404, +${addedBearer} × bearer security`,
  );

  await app.close().catch(() => undefined);
  // Hard exit — Nest schedulers / event-emitter timers may keep loop alive
  setTimeout(() => process.exit(0), 50).unref();
}

// Safety net — never let the script hang forever
const HARD_TIMEOUT_MS = 60_000;
const killer = setTimeout(() => {
  console.error(
    `❌ OpenAPI generation timed out after ${HARD_TIMEOUT_MS / 1000}s.`,
  );
  process.exit(2);
}, HARD_TIMEOUT_MS);
killer.unref();

generate().catch((err) => {
  console.error('❌ OpenAPI generation failed:', err);
  process.exit(1);
});
