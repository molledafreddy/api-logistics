# Sprint A — Catálogo de planes verticalizado

**Fecha**: 2026-04-30
**Estado**: ✅ COMPLETADO
**Tests**: 677 unit + 45 e2e PASS

---

## 1. Objetivo

Habilitar un catálogo de planes **verticalizado** (`courier` / `passenger` / `fleet`) con:

- `code` slug estable (snake_case)
- `audience` y `tier` para filtros
- `limits` cuantitativos (jsonb) consultables en O(1) desde guards

…sin romper la convivencia con los planes legacy (Free / Basic / Business / Enterprise).

---

## 2. Decisiones de arquitectura

### 2.1 Estrategia: ADITIVA (variación al Anexo V3)

| Aspecto                | Plan original (Anexo V3)      | Implementado                                           |
| ---------------------- | ----------------------------- | ------------------------------------------------------ |
| Planes legacy          | Eliminar (migration 2)        | **Conviven** (filtrados del catálogo público)          |
| Columna `code`         | NOT NULL UNIQUE (migration 3) | **Nullable** (UNIQUE parcial `WHERE code IS NOT NULL`) |
| Tests/seeds existentes | Reescribir 5 ubicaciones      | **No se tocaron** (legacy sigue funcionando)           |

**Razón**: el corte completo bloqueaba `ci-test-users.seed.ts` (usa el plan `'Business'` para crear la suscripción del CI test user) y los mocks de `plans-permissions.seed.mock.spec.ts`. El enfoque aditivo entrega 100% del valor funcional de Sprint A (5 planes nuevos + endpoints + jsonb materializado) y desbloquea Sprint B sin riesgo de regresión.

El corte definitivo se hará con dos migraciones diferidas (`RemoveLegacyPlansAndSeedNew` + `MakeCodeNotNullUnique`) cuando se migren las suscripciones existentes (post Sprint E).

### 2.2 Modelo híbrido: tabla + jsonb

```
┌──────────────────┐   sync hook    ┌──────────────────┐
│  plan_limits     │ ─────────────▶ │  plans.limits    │
│  (fuente verdad) │   on CRUD      │  (jsonb cache)   │
└──────────────────┘                └──────────────────┘
   ▲                                          ▲
   │ CRUD admin                               │ Lectura O(1)
   │ (POST/PATCH/DELETE                       │ desde guards
   │  /plans/:id/limits)                      │ (Sprint B+)
```

- **Tabla `plan_limits`**: una fila por (`plan_id`, `vertical`, `code`). Auditable, versionable, indexada con UNIQUE compuesto.
- **`plans.limits` (jsonb)**: shape `{ [vertical]: { [code]: number } }`. Materializado vía SQL `jsonb_object_agg` agrupando por vertical.
- **Sync hook** (`PlansService.syncPlanLimitsJsonb`): se ejecuta automáticamente tras crear / actualizar / eliminar un `PlanLimit`.
- **Vertical reservada `'global'`**: límites que aplican al plan completo independiente del vertical de negocio (ej. `maxStopsPerOptimization`).

---

## 3. Cambios de código

### 3.1 Nuevos archivos

```
api/src/modules/plans/
  enums/
    plan-audience.enum.ts        # PlanAudience { COURIER, PASSENGER, FLEET, ANY }
    plan-tier.enum.ts            # PlanTier { FREE, PRO, ENTERPRISE }
    index.ts
  interfaces/
    plan-limits-map.interface.ts # PlanLimitsMap + PLAN_LIMITS_GLOBAL_VERTICAL
    index.ts
  dto/
    plan-response.dto.ts         # Swagger schema

api/src/database/seeds/
  plans-v2.seed.ts               # 5 planes + 7 permisos (idempotente)
```

### 3.2 Archivos modificados

- `entities/plan.entity.ts` → +4 columnas + 2 OneToMany
- `dto/create-plan.dto.ts` → validators full Sprint A
- `dto/update-plan.dto.ts` → migrado a `@nestjs/swagger PartialType`
- `plans.service.ts` → 5 métodos nuevos + sync hook en CRUD de PlanLimit
- `plans.controller.ts` → 4 endpoints nuevos (declarados ANTES de las rutas dinámicas `:id` para que NestJS resuelva primero los paths estáticos)
- `database/seeds/run-seed.ts` → wired `seedPlansV2()`
- `database/migrations/1709000000001-ExtendPlansForVerticalsAndLimits.ts` (ya existente desde sesión previa)

### 3.3 NO se hizo (diferido)

- ❌ Migration `1709000000002-RemoveLegacyPlansAndSeedNew`
- ❌ Migration `1709000000003-MakeCodeNotNullUnique`
- ❌ Reescritura de `plans-permissions.seed.mock.spec.ts`
- ❌ Cambio de `'Business'` → `'enterprise_fleet'` en `ci-test-users.seed.ts:54`

---

## 4. Catálogo sembrado

| code               | audience  | tier       | precio (CLP) | limits.global                                                                     |
| ------------------ | --------- | ---------- | -----------: | --------------------------------------------------------------------------------- |
| `free_courier`     | courier   | free       |            0 | maxShipmentsPerDay=15, maxStopsPerOptimization=10                                 |
| `pro_courier`      | courier   | pro        |        9.990 | maxShipmentsPerDay=200, maxStopsPerOptimization=50                                |
| `free_passenger`   | passenger | free       |            0 | maxRidesPerDay=10                                                                 |
| `pro_passenger`    | passenger | pro        |       14.990 | maxRidesPerDay=100, maxStopsPerOptimization=30                                    |
| `enterprise_fleet` | fleet     | enterprise |       99.990 | maxShipmentsPerDay=100000, maxStopsPerOptimization=500, +trucking.max_trucks=1000 |

### 7 permisos nuevos

```
optimization.basic         # NN puro (free)
optimization.advanced      # NN + 2-opt (pro)
optimization.vrp           # OR-Tools multi-vehículo (enterprise)
optimization.reoptimize    # Reoptimización dinámica
routes.multi_driver        # Asignación multi-conductor por ruta
passenger.recurring        # Plantillas de viajes recurrentes
tracking.public_link       # Link público de tracking
```

---

## 5. Endpoints nuevos

### 5.1 `GET /v1/plans/catalog` (público)

```bash
curl http://localhost:3000/v1/plans/catalog
```

```json
[
  {
    "id": "...",
    "code": "free_courier",
    "name": "Free Courier",
    "audience": "courier",
    "tier": "free",
    "price": 0,
    "interval": "month",
    "is_active": true,
    "limits": { "global": { "maxShipmentsPerDay": 15, "maxStopsPerOptimization": 10 } }
  },
  ...
]
```

Filtra por `is_active = true AND code IS NOT NULL`. Los planes legacy quedan ocultos.

### 5.2 `GET /v1/plans/me/limits` (auth)

```bash
curl -H "Authorization: Bearer $JWT" http://localhost:3000/v1/plans/me/limits
```

```json
{
  "global": { "maxShipmentsPerDay": 200, "maxStopsPerOptimization": 50 }
}
```

Resuelve la suscripción `active` del usuario y devuelve `plan.limits`. Devuelve `{}` si no hay sub activa.

### 5.3 `PATCH /v1/plans/:id/price` (admin, `plans.write`)

```bash
curl -X PATCH -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
     -d '{"price": 12990}' \
     http://localhost:3000/v1/plans/<plan-uuid>/price
```

Rechaza precios negativos (`400`).

### 5.4 `PATCH /v1/plans/:id/limits` (admin, `plans.write`)

```bash
curl -X PATCH -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
     -d '{"global":{"maxStopsPerOptimization":75}}' \
     http://localhost:3000/v1/plans/<plan-uuid>/limits
```

⚠️ **Sobrescribe** el jsonb completo. NO toca la tabla `plan_limits`. Para mantener coherencia híbrida, preferí los endpoints `POST/PATCH/DELETE /v1/plans/:planId/limits` (que sí disparan el sync hook).

---

## 6. Cobertura de tests

### Unit (9 nuevos en `plans.service.spec.ts`)

- ✅ `syncPlanLimitsJsonb` — agrupa filas por vertical y materializa
- ✅ `syncPlanLimitsJsonb` — devuelve `{}` si tabla vacía
- ✅ `getCatalog` — filtros `is_active = true` + `code IS NOT NULL`
- ✅ `updatePrice` — actualiza correctamente
- ✅ `updatePrice` — rechaza precio negativo
- ✅ `updatePlanLimits` — sobrescribe jsonb
- ✅ `updatePlanLimits` — rechaza null/array
- ✅ `getEffectiveLimits` — devuelve limits del plan activo
- ✅ `getEffectiveLimits` — devuelve `{}` sin sub activa

Además, los 3 tests de `PlanLimit CRUD` se actualizaron para validar que el sync hook se invoca correctamente tras create/update/delete.

### E2E (6 nuevos en `plans.e2e-spec.ts`)

- ✅ `GET /catalog` — público, devuelve sólo planes con code
- ✅ `GET /catalog` — `pro_courier` tiene `limits.global` materializado
- ✅ `GET /me/limits` — autenticado, devuelve mapa
- ✅ `GET /me/limits` — sin auth → 401
- ✅ `PATCH /:id/price` — admin actualiza precio
- ✅ `PATCH /:id/limits` — admin sobrescribe jsonb

---

## 7. Verificación de Swagger

```bash
APP_PORT=3099 ENABLE_SWAGGER=true pnpm start
curl -s http://localhost:3099/docs-json | jq '.paths | keys[] | select(test("/plans"))'
```

Se confirma:

- ✅ `/v1/plans/catalog` (GET)
- ✅ `/v1/plans/me/limits` (GET)
- ✅ `/v1/plans/{id}/price` (PATCH)
- ✅ `/v1/plans/{id}/limits` (PATCH)
- ✅ `PlanResponseDto` registrado en `components.schemas`
- ✅ `CreatePlanDto`, `UpdatePlanDto` actualizados con nuevos campos

⚠️ **Conocido**: `/catalog` aparece con `security: [{ "bearer": [] }]` en el spec por el `@ApiBearerAuth()` global del controller. Funcionalmente es público (`@Public()`), pero la doc puede inducir a error. Se limpiará con un `@PublicSwagger()` decorator futuro.

---

## 8. Próximo paso (Sprint B)

Sprint A queda **listo para Sprint B** (NN+2-opt + `OptimizationLimitsGuard`):

- `pro_courier.limits.global.maxStopsPerOptimization=50` ya disponible
- Permiso `optimization.advanced` ya sembrado
- `getEffectiveLimits(companyId)` listo para que el guard lo consuma con O(1)
