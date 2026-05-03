# Sprint C — Geocoding utility + direcciones embebidas (Modelo C)

**Fecha**: 2026-05-02 → 2026-05-03
**Estado**: � EN PROGRESO — entregadas C.1, C.2, C.3, **C.4** y **C.5**
**Tests**: pendientes (C.6)

---

## 1. Objetivo

Habilitar geocoding como **utility** (no CRUD), embeber direcciones con coordenadas en `shipments` (Modelo C), y dejar la base lista para activar `pro_courier` con optimización Mapbox (C.4).

---

## 2. Decisiones de arquitectura

### 2.1 Modelo C — direcciones embebidas

- **Sin tabla `addresses` central.**
- Direcciones embebidas en `shipments.origin_*` / `shipments.destination_*`.
- Geocoding es un **servicio sin estado** (no persistimos búsquedas).
- `saved_addresses` (favoritos opcionales) queda diferido a Sprint C.5.

### 2.2 Provider intercambiable

```
┌──────────────────┐        ┌────────────────────┐
│ GeocodingService │──────▶│ IGeocodingProvider │
└──────────────────┘        └────────┬───────────┘
        │                            ├── MapboxGeocodingProvider (default si MAPBOX_TOKEN)
        │                            └── MockGeocodingProvider   (fallback dev/test)
        ▼
┌──────────────────────┐
│ GeocodingCacheService │  Redis 24 h (cache-manager global)
└──────────────────────┘
```

Selección del provider en `GeocodingModule` vía `useFactory`:

- `GEOCODING_PROVIDER=mapbox` + `MAPBOX_TOKEN` presente → Mapbox.
- `GEOCODING_PROVIDER=mapbox` sin token → degrada a Mock con warning.
- `GEOCODING_PROVIDER=mock` → Mock siempre.

### 2.3 Cache Redis

- Clave normalizada: `geocoding:{search|reverse}:{provider}:{sha1(payload)}`
- Query normalizada: lowercase + `NFD` + strip diacríticos + collapse espacios.
- Reverse: lat/lng truncados a 5 decimales (~1.1 m) para deduplicar pin-drops.
- TTL configurable (`GEOCODING_CACHE_TTL_SEC`, default 24 h).
- Falla silenciosa si Redis no responde.

### 2.4 Validación blanda en `/optimize`

`OptimizationService.optimizeRun()` ahora devuelve **422** con la lista exacta de shipments que carecen de coordenadas, en lugar de un 400 genérico. Permite al frontend abrir directamente el flujo de geocoding para los faltantes:

```json
{
  "statusCode": 422,
  "code": "OPT-002",
  "message": "Algunos shipments del run no tienen coordenadas de destino. Use /v1/geocoding/search o /v1/geocoding/reverse para completarlas.",
  "missingShipments": [
    { "id": "uuid", "trackingCode": "SH-...", "destinationAddress": "..." }
  ]
}
```

---

## 3. Cambios de código

### 3.1 Nuevos archivos

```
api/src/modules/geocoding/
  geocoding.types.ts              # IGeocodingProvider, GeocodeFeature, SearchOptions
  geocoding-cache.service.ts      # Wrapper Redis con normalización
  geocoding.service.ts            # Orquestación + validación blanda
  geocoding.controller.ts         # 3 endpoints REST
  geocoding.module.ts             # useFactory para resolver provider
  providers/
    mapbox.provider.ts            # Mapbox Geocoding API v6 (forward + reverse)
    mock.provider.ts              # Fixtures determinísticos centrados en Santiago
  dto/
    geocoding-query.dto.ts        # Search / Reverse / Validate query DTOs
    geocode-result.dto.ts         # Response DTOs (Swagger)
    index.ts

api/src/database/migrations/
  1710000000001-AddCoordsToShipments.ts  # +4 columnas (place_id + confidence × 2)
```

### 3.2 Archivos modificados

- `app.module.ts` → registra `GeocodingModule`
- `config/validation.schema.ts` → 5 env vars nuevas
- `.env.example` → bloque `Geocoding (Sprint C)`
- `modules/shipments/entities/shipment.entity.ts` → +4 columnas (`originPlaceId`, `originConfidence`, `destinationPlaceId`, `destinationConfidence`)
- `modules/shipments/dto/create-shipment.dto.ts` → +4 campos opcionales
- `modules/optimization/optimization.service.ts` → reemplazo de `400` por `422` cuando faltan coords (lista los shipments)

### 3.3 NO se hizo (diferido a sub-etapas siguientes)

- ✅ **C.4** — `MapboxOptimizationProvider` (Mapbox Optimization API v1) — entregado 2026-05-03
- ✅ **C.5** — `saved_addresses` + 5 endpoints CRUD (favoritos por company) — entregado 2026-05-03
- ❌ **C.6** — Tests unit (~20) + e2e (~8)

---

## 4. Endpoints nuevos

| Método | Path                                    | Auth | Permiso | Rate-limit |
| ------ | --------------------------------------- | ---- | ------- | ---------- |
| `GET`  | `/v1/geocoding/search?q=...`            | JWT  | —       | 60/min     |
| `GET`  | `/v1/geocoding/reverse?lat=...&lng=...` | JWT  | —       | 60/min     |
| `GET`  | `/v1/geocoding/validate?address=...`    | JWT  | —       | 30/min     |

> Los rate-limits anteceden a la cuota Mapbox. La cuota global del proyecto se protege agresivamente — no es un endpoint público.

---

## 5. Cambios en endpoints existentes (no breaking)

- `POST /v1/shipments` y `PATCH /v1/shipments/{id}` aceptan opcionalmente:
  - `originPlaceId`, `originConfidence`
  - `destinationPlaceId`, `destinationConfidence`
- `POST /v1/delivery-runs/{id}/optimize` → ahora devuelve `422` con `missingShipments` cuando faltan coords (antes: `400` genérico).

Sin coords, todo sigue funcionando como hoy. La validación solo se activa al optimizar.

---

## 6. Migración

`1710000000001-AddCoordsToShipments` (idempotente, `IF NOT EXISTS`):

```sql
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS origin_place_id varchar(200),
  ADD COLUMN IF NOT EXISTS origin_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS destination_place_id varchar(200),
  ADD COLUMN IF NOT EXISTS destination_confidence numeric(3,2);
```

`down()` borra las 4 columnas con `IF EXISTS`.

✅ Aplicada en dev `2026-05-02`.

---

## 7. Variables de entorno nuevas

```bash
# Provider activo
GEOCODING_PROVIDER=mock           # 'mapbox' | 'mock'
MAPBOX_TOKEN=                      # cuenta Free: https://account.mapbox.com/access-tokens/
GEOCODING_DEFAULT_COUNTRY=cl      # ISO-3166-1 alpha-2
GEOCODING_CACHE_TTL_SEC=86400      # 24 h
GEOCODING_RATE_LIMIT_PER_MIN=60    # rate-limit aplicado vía @Throttle
```

---

## 8. Ejemplos curl

### Autocomplete (provider mock)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/geocoding/search?q=Av.+Apoquindo+4501&country=cl&limit=3"
```

```json
{
  "provider": "mock",
  "features": [
    {
      "placeId": "mock.5a3f12c0",
      "formatted": "Av. Apoquindo 4501 #1, Santiago, Chile",
      "coordinates": { "lat": -33.4377, "lng": -70.6502 },
      "confidence": 0.95,
      "country": "cl",
      "region": "Región Metropolitana",
      "locality": "Santiago"
    }
  ],
  "cached": false
}
```

### Reverse (drop-pin)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/geocoding/reverse?lat=-33.4172&lng=-70.6044"
```

### Validate

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/geocoding/validate?address=Av.+Providencia+1208"
```

### Crear shipment con coordenadas

```bash
curl -X POST http://localhost:3000/v1/shipments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originAddress": "Av. Bandera 84, Santiago Centro",
    "originLat": "-33.4378",
    "originLng": "-70.6504",
    "originPlaceId": "mock.5a3f12c0",
    "originConfidence": "0.95",
    "destinationAddress": "Av. Apoquindo 4501, Las Condes",
    "destinationLat": "-33.4172",
    "destinationLng": "-70.6044",
    "destinationPlaceId": "mock.7b2c890d",
    "destinationConfidence": "0.92",
    "description": "Pallets de electrónica"
  }'
```

### Optimize sin coords (422 esperado)

```bash
curl -X POST http://localhost:3000/v1/delivery-runs/$RUN_ID/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{
  "statusCode": 422,
  "code": "OPT-002",
  "message": "Algunos shipments del run no tienen coordenadas de destino. Use /v1/geocoding/search o /v1/geocoding/reverse para completarlas.",
  "missingShipments": [
    { "id": "uuid", "trackingCode": "SH-AB12C", "destinationAddress": "..." }
  ]
}
```

---

## 9. Criterios de "Done" — estado

- [x] Build TypeScript (`tsc --noEmit`) verde
- [x] Migración con `down()` y aplicada en dev (idempotente vía `IF NOT EXISTS`)
- [x] OpenAPI: `@ApiTags`, `@ApiOperation`, `@ApiResponse`, DTOs con `@ApiProperty`
- [x] `CHANGELOG.md` (pendiente — mover entry de `Plan-implementacion-logistics.md`)
- [ ] Tests unit (~20) — diferidos a C.6
- [ ] Tests e2e (~8) — diferidos a C.6
- [x] Sin breaking changes en endpoints existentes

---

## 10. Próximos pasos (orden sugerido)

1. **C.6 Tests** — unit del cache + provider mock + service + Mapbox optimizer + saved-addresses tenancy; e2e con bypass de Mapbox real.
2. Pasar a **Sprint E** (MercadoPago Chile) para llegar al hito de "producto monetizable".

---

## 11. Sprint C.4 — MapboxOptimizationProvider (2026-05-03)

### 11.1 Objetivo

Reemplazar el stub `case 'mapbox'` (que delegaba en Haversine con un warning) por una llamada real a **Mapbox Optimization API v1** (`/optimized-trips/v1/{profile}/{coords}`), con fallback transparente y auditable.

### 11.2 Archivos

```
api/src/modules/optimization/strategies/
  mapbox.optimizer.ts             # NUEVO — IRouteOptimizer con fallback a Haversine
```

Modificados:

- `optimization.module.ts` → registra `MapboxOptimizationProvider`
- `optimization.service.ts` → inyecta `mapbox`; `pickOptimizer('mapbox')` ahora delega real
- `config/validation.schema.ts` → 2 vars nuevas
- `.env.example` → bloque `Mapbox Optimization (Sprint C.4)`

### 11.3 Reglas de negocio

| Código     | Regla                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| OPT-MB-001 | Sin `MAPBOX_TOKEN` → fallback transparente a Haversine (`fellBackToHaversine=true`) |
| OPT-MB-002 | Error HTTP / timeout (`AbortController`) / `code != "Ok"` → fallback Haversine      |
| OPT-MB-003 | Mapbox v1 admite máx **12 coords** (origen + 11 stops); excedido → fallback         |
| OPT-MB-004 | Llamada con `source=first`, `destination=last`, `roundtrip=false`                   |

### 11.4 Variables de entorno

```bash
MAPBOX_OPTIMIZATION_PROFILE=mapbox/driving-traffic   # 'mapbox/driving' | 'walking' | 'cycling'
MAPBOX_OPTIMIZATION_TIMEOUT_MS=15000                  # excedido → fallback Haversine
```

### 11.5 Endpoint impactado (sin cambios en el contrato)

`POST /v1/delivery-runs/:id/optimize`

```bash
curl -X POST http://localhost:3000/v1/delivery-runs/$RUN_ID/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"mapbox"}'
```

Respuesta (resumida):

```json
{
  "id": "...",
  "optimizedSequence": [
    "shipment-uuid-2",
    "shipment-uuid-1",
    "shipment-uuid-3"
  ],
  "estimatedDistanceKm": "24.31",
  "estimatedDurationMin": 47,
  "optimizationProvider": "mapbox",
  "etaPerStop": [
    {
      "shipmentId": "...",
      "distanceFromPrevKm": 8.42,
      "durationFromPrevMin": 14.5,
      "etaAt": null
    }
  ]
}
```

Si Mapbox falla, el evento `delivery_run.optimized` lleva `fellBackToHaversine=true`.

---

## 12. Sprint C.5 — Saved Addresses (2026-05-03)

### 12.1 Objetivo

Permitir a cada compañía mantener un libro de favoritos (warehouses, clientes recurrentes, dropoffs frecuentes) para acelerar la creación de shipments y futura UI de selección rápida.

### 12.2 Archivos

```
api/src/modules/saved-addresses/
  saved-addresses.module.ts
  saved-addresses.service.ts
  saved-addresses.controller.ts
  entities/saved-address.entity.ts
  dto/{create,update,query,index}.ts

api/src/database/migrations/
  1710000000002-CreateSavedAddresses.ts
```

### 12.3 Reglas de negocio

| Código  | Regla                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| SAV-001 | Tenancy estricta — solo el `companyId` dueño puede ver/mutar (SUPER_ADMIN bypass)          |
| SAV-002 | Unicidad parcial de `(company_id, label)` solo entre `deleted_at IS NULL` → `409 Conflict` |
| SAV-003 | Soft delete (`deleted_at`) — el `DELETE` libera el `label` para reutilización              |

### 12.4 Endpoints

| Método   | Path                                             | Roles                                        | Status OK |
| -------- | ------------------------------------------------ | -------------------------------------------- | --------- |
| `POST`   | `/v1/saved-addresses`                            | OWNER/ADMIN/MANAGER/DISPATCHER + SUPER_ADMIN | 201       |
| `GET`    | `/v1/saved-addresses?kind=&search=&page=&limit=` | cualquier user con companyId                 | 200       |
| `GET`    | `/v1/saved-addresses/:id`                        | cualquier user con companyId                 | 200       |
| `PATCH`  | `/v1/saved-addresses/:id`                        | OWNER/ADMIN/MANAGER/DISPATCHER + SUPER_ADMIN | 200       |
| `DELETE` | `/v1/saved-addresses/:id`                        | OWNER/ADMIN/MANAGER/DISPATCHER + SUPER_ADMIN | 204       |

`kind` ∈ `depot | customer | dropoff | pickup | other`.

### 12.5 Validaciones end-to-end (2026-05-03)

| Caso                                | Resultado               |
| ----------------------------------- | ----------------------- |
| `POST` depot válido                 | `201` ✅                |
| `POST` customer válido              | `201` ✅                |
| `POST` con label duplicado          | `409 SAV-002` ✅        |
| `GET` con search                    | resultados filtrados ✅ |
| `DELETE` válido                     | `204` (body vacío) ✅   |
| `DELETE` id inexistente             | `404` ✅                |
| Cualquier endpoint con JWT expirado | `401` ✅                |
