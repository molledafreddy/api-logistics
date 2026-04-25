# OpenAPI Toolchain

Pipeline de **3 scripts** que generan, auditan y exportan la documentación
OpenAPI/Swagger del API sin necesidad de levantar la base de datos.

```
src/**/*.ts (decorators @nestjs/swagger)
        │
        │  pnpm openapi:generate
        ▼
docs/openapi.json  ──► pnpm openapi:audit  ──► docs/openapi-audit.md
        │
        │  pnpm openapi:postman
        ▼
docs/postman/api-logistics.postman_{collection,environment}.json
```

---

## 🛠️ Scripts

| Script (`pnpm`)    | Archivo               | Output                                |
| ------------------ | --------------------- | ------------------------------------- |
| `openapi:generate` | `generate-openapi.ts` | `docs/openapi.json`                   |
| `openapi:audit`    | `audit-openapi.ts`    | `docs/openapi-audit.md` (+ exit code) |
| `openapi:postman`  | `generate-postman.ts` | `docs/postman/*.json`                 |
| `openapi:check`    | _composite_           | generate + audit (CI-friendly)        |
| `openapi:full`     | _composite_           | generate + audit + postman            |

---

## 1️⃣ `generate-openapi.ts`

### Reto

`AppModule` importa `TypeOrmModule.forRootAsync(...)` que llama a
`DataSource.initialize()` → intenta conectar a Postgres → **el script se cuelga**
si no hay BD disponible (CI, dev sin docker, etc.).

### Solución

Usar `@nestjs/testing` con **override del provider `DataSource`**:

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(DataSource)
  .useValue(fakeDataSource)
  .overrideProvider(getDataSourceToken())
  .useValue(fakeDataSource)
  .compile();
```

El `fakeDataSource` es un objeto que:

- Tiene `entityMetadatas: []` (Nest no intenta registrar repositorios reales)
- Devuelve un **stub repo chainable** vía `Proxy` para `getRepository`,
  `createQueryBuilder`, `manager.transaction(cb)`, etc.
- Cualquier método de QueryBuilder (`where`, `leftJoin`, `orderBy`...) devuelve
  el mismo objeto chainable. Los terminadores (`getMany`, `getOne`, `execute`)
  devuelven valores vacíos por defecto.

### Decisiones clave

- **No llama `app.init()` ni `app.listen()`** → no se disparan `onModuleInit`,
  no se bindean WebSockets, no se inicializa BullMQ.
- `SwaggerModule.createDocument(app, config)` solo recorre la metadata del
  contenedor Nest, así que **funciona sin app inicializada**.
- Aplica `app.setGlobalPrefix('api/v1')` para que las paths del spec coincidan
  con producción.

### Post-process automático

Tras generar el documento, recorre todas las operations y **inyecta**:

```
PUBLIC_PATH_RE = [
  /^\/api\/v1\/?$/, /^\/api\/v1\/health/i,
  /^\/api\/v1\/auth\/(register|login|refresh)/i,
  /^\/api\/v1\/users\/accept-invite/i,
]
```

| Condición                               | Inyecta                                 |
| --------------------------------------- | --------------------------------------- |
| No es public path & no tiene `security` | `security: [{ bearer: [] }]`            |
| No es public path                       | `responses['401']` y `responses['403']` |
| Path tiene `{param}` y método ≠ POST    | `responses['404']`                      |

**Razón**: en lugar de añadir `@ApiResponse({status: 401})` a 178 endpoints
(spam de decorators), centralizamos la regla en un único lugar (DRY).

Output del script:

```
+401: 168   +404: 53   +bearer: 23
```

---

## 2️⃣ `audit-openapi.ts`

### Reglas evaluadas (por operation)

| Regla                    | Nivel     | Descripción                                 |
| ------------------------ | --------- | ------------------------------------------- |
| `missing-summary`        | **error** | falta `summary`                             |
| `missing-tags`           | **error** | falta al menos un tag                       |
| `duplicate-operation-id` | **error** | `operationId` repetido                      |
| `missing-2xx`            | **error** | sin response 2xx                            |
| `inline-body-schema`     | warn      | `requestBody` con schema inline (no `$ref`) |
| `missing-401`            | warn      | endpoint privado sin response 401           |
| `missing-404`            | warn      | path con `:id` sin response 404             |
| `missing-bearer`         | warn      | endpoint privado sin `security`             |

### Outputs

- **Stdout**: resumen `Errors: X   Warnings: Y   Operations: N`
- **`docs/openapi-audit.md`**: reporte completo con tablas por regla
- **Exit code**: `0` si 0 errors (warnings permitidos), `1` si ≥ 1 error

### Estado actual

```
Errors: 0   Warnings: 0   Operations: 178
With summary:    178/178 (100.0%)
With tags:       178/178 (100.0%)
With security:   171/178 (96.1%)   ← los 7 son public paths
With 2xx:        178/178 (100.0%)
```

---

## 3️⃣ `generate-postman.ts`

Convierte `docs/openapi.json` → Postman Collection v2.1 + Environment.

Ver [`docs/postman/README.md`](../../docs/postman/README.md) para detalles
del workflow Postman (login automático, variables, etc.).

### Características técnicas

- **Sin dependencias adicionales** — solo Node fs.
- Resuelve `$ref` recursivamente para generar **bodies de ejemplo**.
- Usa `format` del schema para valores realistas:
  - `uuid` → `00000000-0000-0000-0000-000000000000`
  - `email` → `user@example.com`
  - `date-time` → `new Date().toISOString()`
- **Test scripts** para `/auth/login` y `/auth/refresh` que persisten el JWT
  en `pm.environment` y `pm.collectionVariables`.
- Endpoints con `security: []` se marcan como `auth: { type: 'noauth' }`.

---

## 🔁 Cuándo regenerar

| Cambio                             | Comando                |
| ---------------------------------- | ---------------------- |
| Añades/modificas un endpoint o DTO | `pnpm openapi:full`    |
| Solo quieres validar el spec       | `pnpm openapi:check`   |
| Solo recargar Postman              | `pnpm openapi:postman` |

> 💡 En CI: corre `pnpm openapi:check` para que el build falle si alguien
> introduce un endpoint sin summary/tags/2xx.

---

## 🧠 FAQ

**¿Por qué `Test.createTestingModule` y no `NestFactory.create`?**
Porque necesitamos `overrideProvider(DataSource)` para evitar la conexión a
Postgres. `NestFactory.create` no expone esa API.

**¿Por qué post-procesar el spec en lugar de añadir decorators?**
Por consistencia (todas las rutas autenticadas tienen 401/403/404 idénticos)
y mantenimiento (1 lugar vs 178 endpoints). Los decorators siguen siendo la
fuente para summaries, tags y bodies específicos.

**¿Qué pasa si un endpoint público se cuela con `security`?**
El generator no lo detecta como público y le inyectará 401. Solución:
añadirlo al array `PUBLIC_PATH_RE` en `generate-openapi.ts` **y** al
`PUBLIC_PATHS` en `audit-openapi.ts` (mantener ambos en sync).

**¿Por qué el audit reporta 96.1% de security en lugar de 100%?**
Porque los 7 endpoints públicos declarados están correctamente sin auth.
Es la métrica esperada.
