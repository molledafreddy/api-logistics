# 🛡️ Convención de seguridad de endpoints

> Implementación del Plan §20 — Middleware de Permisos, Guards y Decorators.

## Pipeline global de Guards (orden importa)

Todos los endpoints atraviesan automáticamente esta cadena, registrada como `APP_GUARD` en `app.module.ts`:

```
1. ThrottlerGuard           → Rate limiting multi-bucket (short / medium / long)
2. JwtAuthGuard             → Valida JWT Supabase, popula request.user
3. RolesGuard               → Verifica @Roles(...)
4. PermissionGuard          → Verifica @Permissions(...) contra el plan activo (Redis cache 5min)
5. CompanyOwnershipGuard    → Aislamiento multi-tenant si la request trae companyId explícito
```

## Decoradores disponibles

| Decorador                                                 | Aplica a           | Efecto                                                                                                 |
| --------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `@Public()`                                               | handler/controller | Bypass de **todos** los guards (auth, roles, permission, ownership)                                    |
| `@Roles(UserRole.ADMIN, ...)`                             | handler/controller | Restringe por rol del usuario. `super_admin` siempre pasa.                                             |
| `@Permissions('trucks.create', ...)`                      | handler/controller | Exige **TODOS** los permisos contra el plan activo de la empresa. Devuelve 403 listando los faltantes. |
| `@AnyPermission(...)`                                     | handler/controller | Variante OR (alguno basta).                                                                            |
| `@PlanFeature('feature.code')`                            | handler/controller | Combina con `@UseGuards(PlanFeatureGuard)`.                                                            |
| `@PlanLimit('resource', countFn)`                         | handler/controller | Combina con `@UseGuards(PlanLimitGuard)`.                                                              |
| `@SuperAdmin()`                                           | handler/controller | Atajo para `@Roles(UserRole.SUPER_ADMIN)`.                                                             |
| `@RequireBusinessModel(...)` / `@RequireServiceType(...)` | handler/controller | Multi-vertical (Sprint 0).                                                                             |
| `@CurrentUser()`                                          | parámetro          | Inyecta el `IUserPayload` del JWT.                                                                     |

## Convención obligatoria al crear un endpoint nuevo

Para CADA controlador nuevo:

1. **Auth**: si es público, marcar explícitamente con `@Public()`. Si no, no hace falta nada (JwtAuthGuard es global).
2. **Rol**: declarar `@Roles(...)` con los roles mínimos que pueden acceder. Sin esto, **cualquier usuario autenticado entra**.
3. **Permiso de plan** (recomendado para endpoints de negocio): declarar `@Permissions('recurso.acción')`. El permiso debe existir en `permission_definitions` y estar asignado al menos a un plan en `plan_permissions`.
4. **Multi-tenant**: si el endpoint recibe `:companyId` en params/body/query, `CompanyOwnershipGuard` lo valida automáticamente. Si trabaja con recursos hijos (ej. `/trucks/:id`), el **service** debe filtrar por `user.companyId` (defensa en profundidad).
5. **Auditoría**: para mutaciones sensibles, agregar `@Audit({ action, resource })`.

### Ejemplo canónico

```typescript
@Post()
@Roles(UserRole.ADMIN, UserRole.COMPANY_OWNER)
@Permissions('trucks.create')
@Audit({ action: 'create', resource: 'truck' })
@ApiOperation({ summary: 'Crear camión' })
async create(@CurrentUser() user: IUserPayload, @Body() dto: CreateTruckDto) {
  return this.trucksService.create(user.companyId, dto);
}
```

## Cache de permisos (Redis)

`PermissionsCacheService` (en `common/cache/`) cachea el set de códigos de permisos por empresa:

- **Clave**: `company:{companyId}:permissions`
- **TTL**: 5 minutos
- **Backend**: Redis (cache-manager-redis-yet), configurado globalmente en `CommonModule`
- **Invalidación**: explícita desde `PlansService.assignPermissions(...)` y `SubscriptionsService` cuando cambia el plan.
- **Fallback**: si Redis cae, el guard hace fallback a la DB (degrada a null y reconsulta).

## Rate limiting por endpoint

Globalmente todos los endpoints heredan los 3 buckets (`short`/`medium`/`long`). Para endpoints sensibles, sobreescribir con `@Throttle()`:

```typescript
@Post('login')
@Throttle({
  short: { limit: 5, ttl: 60_000 },     // 5/min
  long:  { limit: 30, ttl: 3_600_000 }, // 30/h
})
async login(...) {}
```

Ya aplicado en: `auth.controller.ts` (login, register, refresh).

## Anti-patrones a evitar

- ❌ `console.log(request.user)` o cualquier log con PII en guards/services.
- ❌ Endpoints sin `@Roles()` que devuelvan datos de empresa (cualquier usuario autenticado podrá listarlos).
- ❌ Services que no filtren por `user.companyId` confiando en `CompanyOwnershipGuard` (sólo se activa si la request trae `companyId` explícito).
- ❌ Invalidar la cache de permisos desde múltiples puntos sin un único punto de entrada (`PermissionsCacheService.invalidate(companyId)`).
- ❌ Marcar un endpoint con `@Public()` sin necesidad real (rompe todo el pipeline).
