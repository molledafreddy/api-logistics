# Changelog

## [Unreleased]

### Added — Sprint C.6: Tests automatizados de Geocoding + SavedAddresses + Mapbox Optimizer (2026-05-03)

- **53 unit tests nuevos** distribuidos en 6 specs (sin red, sin BD, `global.fetch` mockeado donde aplica).
- **`geocoding-cache.service.spec.ts` (8)** — normalización de query (case + diacríticos + spaces), cuantización reverse a 5 decimales, TTL en ms, tolerancia a Redis ausente o caído (no-op silencioso).
- **`mock.provider.spec.ts` (6)** — determinismo, respeto de `limit` (cap 5), coords plausibles en Santiago, override de `country`.
- **`mapbox.provider.spec.ts` (10)** — armado de URL (q/country/limit/language/proximity/types), mapeo de `match_code.confidence` (`exact|high|medium|low|inaccurate` → `1.0..0.2`), reintentos solo en 5xx, `ServiceUnavailableException` sin token o tras retries.
- **`geocoding.service.spec.ts` (8)** — GEO-001/002/003, hit/miss de cache, `defaultCountry` aplicado, `validate()` devolviendo primer match o `null`.
- **`mapbox.optimizer.spec.ts` (7)** — OPT-MB-001/002/003 (fallback con `provider='mapbox' + fellBackToHaversine=true`), parser de respuesta real (reordena por `waypoint_index`, suma legs), URL con `source=first/destination=last/roundtrip=false`. Usa `HaversineOptimizer` real para validar el fallback E2E.
- **`saved-addresses.service.spec.ts` (12)** — SAV-001 (tenant mismatch → 403), SAV-002 (label duplicado en create + update → 409), SAV-003 (softRemove), SUPER_ADMIN bypass, `findAll` con filtros tenant/kind/q.
- **Resultado total**: `78 suites · 730 tests · 7.8 s` (antes 72 / 677). E2E suite diferida (requiere setup Supabase Auth + Redis en CI, ya hay 4 e2e marcadas `.skip` por la misma razón).

### Fixed — Migración `FixPlansAddCodeColumnAndIndexes` idempotente en BD limpia (2026-05-03)

- La migración `1680000009999-FixPlansAddCodeColumnAndIndexes` (timestamp menor que `1702400000001-CreatePlansAndPermissionsTables`) crasheaba en CI con `relation "plans" does not exist` porque corre antes de que la tabla sea creada.
- Envuelta en `DO $$ IF EXISTS plans $$` (up + down) — no-op en BD limpia, sigue siendo el hotfix histórico para entornos productivos donde `plans` ya existía. La migración `1709000000001-ExtendPlansForVerticalsAndLimits` añade las mismas columnas más adelante de forma idempotente.

### Added — Sprint C.5: Saved Addresses (favoritos por compañía) (2026-05-03)

- **Nuevo módulo `saved-addresses/`** — libro de direcciones favoritas por compañía (warehouses, clientes recurrentes, dropoffs).
- **Tabla `saved_addresses`** — FK a `companies`, `kind` ∈ `depot|customer|dropoff|pickup|other`, coords `numeric` con `place_id` + `confidence`, soft delete (`deleted_at`).
- **Migración `1710000000002-CreateSavedAddresses`** — crea tabla + índice geo + **índice único parcial** `(company_id, label) WHERE deleted_at IS NULL` (permite reutilizar label tras soft delete).
- **5 endpoints REST** bajo `/v1/saved-addresses` (POST/GET list/GET one/PATCH/DELETE) — DELETE devuelve `204` y soft-deletes vía `softRemove`.
- **Reglas de negocio**:
  - `SAV-001` Tenancy estricta (SUPER_ADMIN bypass).
  - `SAV-002` Label duplicado → `409 Conflict`.
  - `SAV-003` Soft delete libera el label para reutilización.
- **Roles**: lectura abierta a cualquier user con companyId; mutaciones limitadas a OWNER/ADMIN/MANAGER/DISPATCHER + SUPER_ADMIN.
- **Swagger**: `@ApiTags('Saved Addresses')`, `@ApiBearerAuth`, responses 201/204/409 documentados.
- **Validado end-to-end** con curl: 201 OK, 409 dup-label, 204 delete, 404 not-found, 401 JWT expirado.

### Added — Sprint C.4: MapboxOptimizationProvider (2026-05-03)

- **Nueva strategy `MapboxOptimizationProvider`** (`api/src/modules/optimization/strategies/mapbox.optimizer.ts`) implementando `IRouteOptimizer`.
- Llama a **Mapbox Optimization API v1** (`/optimized-trips/v1/{profile}/{coords}`) con `source=first`, `destination=last`, `roundtrip=false`, profile default `mapbox/driving-traffic` (incluye tráfico real-time).
- **Reglas de negocio**:
  - `OPT-MB-001` Sin `MAPBOX_TOKEN` → fallback transparente a Haversine.
  - `OPT-MB-002` Error HTTP / timeout (`AbortController`) / `code != "Ok"` → fallback Haversine, `fellBackToHaversine=true` auditable en evento `delivery_run.optimized`.
  - `OPT-MB-003` Mapbox v1 admite máx **12 coords** (origen + 11 stops); excedido → fallback.
  - `OPT-MB-004` `source=first` fija el warehouse; `destination=last` permite a la API elegir el último stop.
- **`OptimizationService.pickOptimizer('mapbox')`** ya no hace warning "no implementado" — delega real al nuevo provider.
- **2 env vars nuevas**: `MAPBOX_OPTIMIZATION_PROFILE` (default `mapbox/driving-traffic`), `MAPBOX_OPTIMIZATION_TIMEOUT_MS` (default `15000`).
- Sin cambios en el contrato del endpoint `POST /v1/delivery-runs/:id/optimize` — Swagger ya cubría `provider ∈ haversine|google_routes|mapbox` desde Sprint 7.
- Build TypeScript verde (`tsc --noEmit` exit 0).

### Added — Sprint C (parcial: C.1 + C.2 + C.3): Geocoding utility + direcciones embebidas (2026-05-02)

> **Hito**: base lista para `pro_courier` con optimización Mapbox (C.4 siguiente). Modelo C confirmado (sin tabla central `addresses`; coordenadas + `place_id` + `confidence` embebidas en `shipments`).

- **Nuevo módulo `geocoding/`** con interfaz `IGeocodingProvider` intercambiable. Providers entregados:
  - `MapboxGeocodingProvider` — Mapbox Geocoding API v6 (forward + reverse), timeout 4 s, 1 retry en 5xx.
  - `MockGeocodingProvider` — fixtures determinísticos centrados en Santiago, útil sin `MAPBOX_TOKEN`.
- **`GeocodingCacheService`** sobre Redis (cache-manager global): clave normalizada con sha1(payload), TTL `GEOCODING_CACHE_TTL_SEC` (default 24 h), falla silenciosa si Redis cae.
- **3 endpoints REST** (rate-limited via `@Throttle`):
  - `GET /v1/geocoding/search?q=...&proximity=lat,lng&country=cl&limit=5` — autocomplete.
  - `GET /v1/geocoding/reverse?lat=...&lng=...` — drop-pin → dirección.
  - `GET /v1/geocoding/validate?address=...` — confirma/enriquece una dirección dada.
- **Migración `1710000000001-AddCoordsToShipments`** (idempotente, `IF NOT EXISTS`) — agrega `origin_place_id`, `origin_confidence`, `destination_place_id`, `destination_confidence` (`numeric(3,2)`) a `shipments`.
- **`Shipment` entity** + **`CreateShipmentDto`** extendidos (campos opcionales, no breaking).
- **`OptimizationService.optimizeRun()`** ahora lanza **422** con `missingShipments[]` cuando faltan coords (antes: `400` genérico). Permite al frontend abrir directamente el flujo de geocoding.
- **5 env vars nuevas**: `GEOCODING_PROVIDER`, `MAPBOX_TOKEN`, `GEOCODING_DEFAULT_COUNTRY`, `GEOCODING_CACHE_TTL_SEC`, `GEOCODING_RATE_LIMIT_PER_MIN`.
- Documentación: `docs/sprints/sprint-c-geocoding.md`.

> **Diferido**: C.6 tests unit + e2e.

### Added — Sprint A: Catálogo de planes verticalizado (2026-04-30)

> **Estrategia adoptada: ADITIVA híbrida** (variación al plan original "reemplazo total").
> Los 4 planes legacy (Free / Basic / Business / Enterprise) **conviven** con los
> 5 planes nuevos. La columna `code` permanece _nullable_; sólo los planes con
> `code IS NOT NULL` aparecen en `/plans/catalog`. Las migraciones destructivas
> 2 y 3 del Anexo V3 quedan diferidas hasta el corte de legacy (post Sprint E).

- **Entidad `Plan`**: nuevas columnas `code` (snake_case, único parcial), `audience` (`courier|passenger|fleet|any`), `tier` (`free|pro|enterprise`), `limits jsonb` materializado.
- **Arquitectura híbrida**: la tabla `plan_limits` sigue siendo _fuente de verdad_ (auditable, CRUD admin) y `plans.limits` (jsonb) es la _materialización_ para lecturas O(1) en guards (Sprint B).
- **Sync hook automático** (`PlansService.syncPlanLimitsJsonb`): se invoca tras `createPlanLimit / updatePlanLimit / removePlanLimit` y reagrupa la tabla → jsonb.
- **5 planes nuevos** (sembrados de forma idempotente en `plans-v2.seed.ts`):
  - `free_courier` (CLP 0, 15 envíos/día, 10 stops/optim)
  - `pro_courier` (CLP 9.990, 200 envíos/día, 50 stops/optim)
  - `free_passenger` (CLP 0, 10 viajes/día)
  - `pro_passenger` (CLP 14.990, 100 viajes/día, 30 stops/optim)
  - `enterprise_fleet` (CLP 99.990, 1000 trucks, 500 stops/optim)
- **7 permisos nuevos**: `optimization.basic|advanced|vrp|reoptimize`, `routes.multi_driver`, `passenger.recurring`, `tracking.public_link`.
- **4 endpoints nuevos**:
  - `GET /v1/plans/catalog` — público (`@Public()`), sólo planes con `code`
  - `GET /v1/plans/me/limits` — auth, deriva sub activa → `plan.limits`
  - `PATCH /v1/plans/:id/price` — admin, sólo precio
  - `PATCH /v1/plans/:id/limits` — admin, sobrescribe jsonb completo
- **DTO**: `PlanResponseDto` (Swagger schema) + `CreatePlanDto` con `@Matches(/^[a-z][a-z0-9_]*$/)`, `@IsIn(ALL_PLAN_AUDIENCES)`, `@IsIn(ALL_PLAN_TIERS)`, `@IsObject` para limits, `@Min(0)` para price. `UpdatePlanDto` migrado de `@nestjs/mapped-types` a `@nestjs/swagger`.
- **Tests**: 9 unit nuevos (sync hook, getCatalog, updatePrice, updatePlanLimits, getEffectiveLimits con/sin sub) + 6 e2e nuevos (catálogo público, materialización, /me/limits con/sin auth, PATCH price, PATCH limits) → **677 unit + 45 e2e PASS**.
- **Swagger**: 4 endpoints nuevos visibles en `/docs`, `PlanResponseDto` registrado en `components.schemas`.

#### Conocido / pendiente

- `/plans/catalog` aparece con `security: [bearer]` en el spec OpenAPI por el `@ApiBearerAuth()` global del controller; funciona como público pero la doc puede confundir. Se limpiará con un decorador `@PublicSwagger()` futuro.
- Migrations 2 (RemoveLegacyPlansAndSeedNew) y 3 (MakeCodeNotNullUnique) del Anexo V3 quedan diferidas para no romper `ci-test-users.seed.ts` (usa `'Business'`) ni los mocks `plans-permissions.seed.mock.spec.ts`.

### Fixed — Sprint 0: Hotfix permisos

- **plans.service.ts:** El método `getEffectivePermissions` ahora obtiene los permisos efectivos de la empresa consultando la suscripción activa y el plan asociado, alineando la lógica con el PermissionGuard. Esto corrige el bug donde empresas con plan activo podían recibir permisos vacíos si el companyId no coincidía con un plan.
- **Tests:** Se ajustaron los tests unitarios para mockear correctamente el acceso a la base de datos y asegurar cobertura y no regresión.

Todos los cambios notables del proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado semántico ([SemVer](https://semver.org/lang/es/)).

---

## [Unreleased]

### Added — E2E Testing Foundation

- **E2E infrastructure** (`docker-compose.test.yml`): Postgres 13 en :5433 +
  Redis 6.2 en :6380 para tests aislados.
- **Jest E2E config** (`jest.config.e2e.cjs`):
  - Serial execution (`maxWorkers: 1`) para evitar exhaustión del pool
  - Timeout 60s para app bootstrap
  - `setupFiles` ejecuta mocks + env setup antes de compilar tests
  - `forceExit: true` limpia handles al terminar
- **Global setup files**:
  - `test/setup-e2e-mocks.ts`: `jest.mock('jwks-rsa')` con JwksClient dummy
  - `test/setup-e2e.ts`: fuerza `E2E_TEST=true`, `NODE_ENV=test`
- **Test helpers** (`test/helpers/test-app.helper.ts`):
  - `createTestApp()`: instancia NestJS con AppModule + validación global
  - `getAccessToken()`: obtiene JWT válido vía Supabase Auth
  - `closeTestApp()`: cleanup de app + db connections
- **Smoke test** (`test/app.e2e-spec.ts`): 2 tests para endpoints root + health
- **4 suites E2E activas**:
  - `test/modules/audit.e2e-spec.ts`: 3 tests (list + filters)
  - `test/modules/plans.e2e-spec.ts`: 4 tests (CRUD + permissions)
  - `test/modules/notifications.e2e-spec.ts`: 4 tests (push tokens + settings)
  - **Total**: 13 tests passing, ~4.2s execution (serial)
- **Documentation**: `docs/E2E-STATUS.md` con arquitectura + troubleshooting

### Added — DX / Quality gates

- **Pre-push hook** (`.husky/pre-push`): ejecuta `pnpm test` + `env:check` +
  `openapi:check` antes de cada `git push` (~25s). Aborta el push si alguna
  verificación falla. Saltable con `git push --no-verify` o `SKIP_HOOKS=1`.
- **Validación de env vars completa** (`src/config/validation.schema.ts`):
  añadidas `SUPABASE_JWT_AUD`, `SUPER_ADMIN_*`, `SEED_DEMO`, `E2E_TEST`,
  `DATABASE_URL`. `ConfigModule` ahora usa `abortEarly: false` para reportar
  TODAS las vars inválidas a la vez.
- **Script `pnpm env:check`** (`scripts/check-env-schema.ts`): valida que
  `.env.example` siga siendo coherente con el Joi schema (detecta drift).

### Added — OpenAPI & Postman toolchain

- **Pipeline OpenAPI completo** sin dependencia de Postgres:
  - `pnpm openapi:generate` — `docs/openapi.json` (178 operations, 60 schemas)
  - `pnpm openapi:audit` — `docs/openapi-audit.md` (0 errors, 0 warnings)
  - `pnpm openapi:postman` — colección + environment Postman v2.1
  - `pnpm openapi:check` — generate + audit (CI)
  - `pnpm openapi:full` — generate + audit + postman
- **Generator** (`scripts/openapi/generate-openapi.ts`):
  - `Test.createTestingModule` con `overrideProvider(DataSource)` (fake stub)
  - Post-process auto-inyecta `401/403/404` + `bearer` en endpoints privados (DRY)
  - Aplica `setGlobalPrefix('api/v1')` para coincidir con producción
- **Auditor** (`scripts/openapi/audit-openapi.ts`):
  - 8 reglas (4 errors / 4 warnings)
  - Reporte Markdown + exit code para CI
- **Postman generator** (`scripts/openapi/generate-postman.ts`):
  - 24 folders (por tag), 178 requests
  - Auto-extracción de JWT en `/auth/login` y `/auth/refresh`
  - Bodies de ejemplo desde schemas (resuelve `$ref`)
- **Documentación**:
  - `docs/postman/README.md` — workflow Postman + Newman
  - `scripts/openapi/README.md` — arquitectura del toolchain

### Added — DTOs / Swagger

- `src/modules/subscriptions/dto/index.ts`: 4 DTOs tipados
  (`CreateFreeSubscriptionDto`, `ChangePlanDto`, `AddAddonDto`,
  `UpdateAddonQuantityDto`) reemplazan `@ApiBody({schema:...})` inline.
- `@ApiBearerAuth()` a nivel clase en `subscriptions.controller.ts` y
  `plans.controller.ts`.
- `@ApiOperation` + `@ApiTags` en `root.controller.ts`.

### Tests — Sprint 21-22 (lotes 1-6)

- **Lote 1-4** (services / repositories / domain): base de cobertura.
- **Lote 5** (thin controllers, +13 specs):
  auth, users, companies, dashboard, routes, tracking, reports, files,
  notifications, relationships, admin, audit, optimization.
- **Lote 6** (infra, +17 specs):
  utils, pipes, middleware, interceptors, filters, guards.
  - Fix ESM `uuid` en `parse-uuid.pipe.spec.ts` con `jest.mock('uuid')`.

#### Métricas finales

|          | Antes  | Después       |
| -------- | ------ | ------------- |
| Suites   | 42     | **72**        |
| Tests    | 519    | **656**       |
| Coverage | 32.42% | **73.21%** ✅ |

### Fixed

- E2E: cuarentena de 9 suites inestables (`docs/E2E-QUARANTINE.md`).
- `WsAuthService`: interop con `jwks-rsa` corregido.

---

## [0.1.0] — Fase 0 + Sprints 0-7

- Setup inicial del proyecto (NestJS 11, TypeORM, Postgres, Redis, BullMQ).
- Módulos base: auth (JWT + roles), users, companies, routes, tracking,
  dashboard, reports, files (S3), notifications, subscriptions, plans,
  admin, audit, optimization.
- WebSockets para tracking en tiempo real.
- Migraciones + seeds (incluyendo `seed:demo`).
- Sentry, Throttler, Cache Manager, Schedule.
