# Changelog

Todos los cambios notables del proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado semántico ([SemVer](https://semver.org/lang/es/)).

---

## [Unreleased]

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
