# Sprint F.1 — Dev scripts

Smoke tests manuales para el ciclo de auto-cobro recurrente. **No** se compilan
con `pnpm build` ni se ejecutan en CI: son utilidades para validar end-to-end
contra una DB local de desarrollo.

Todos asumen `.env.development` (DATABASE_URL, REDIS_HOST, REDIS_PORT) y la
existencia de la suscripción de prueba `f804c412-09c4-4e39-a65a-7058b6723738`
(usuario `molledafreddy@gmail.com`, plan Business 100 CLP).

## Cómo ejecutar

```bash
cd api
npx ts-node -r tsconfig-paths/register scripts/dev/<script>.ts
```

Cada `setup-ren-XXX` muta la sub al estado del caso, después corre
`force-renewal-scan` para disparar el scheduler manualmente y por último
`check-sub` para verificar el estado resultante.

| Script | Qué hace |
|---|---|
| `force-renewal-scan.ts` | Bootea AppModule sin HTTP, llama `RenewalSchedulerService.scan()` y espera 25 s a que el worker procese. Requiere `SKIP_BULL_SETUP=false`. |
| `setup-ren-004.ts` | Periodo vencido hace 1 h, sin gracia abierta → debe abrir `grace_period_until=now+7d`, status `pending_payment`, y generar checkout mock. |
| `setup-ren-005.ts` | Periodo vencido hace 10 d, gracia expirada hace 1 d → debe pasar a `canceled`. |
| `setup-ren-007.ts` | Plan Free + periodo vencido hace 30 d → debe extender el periodo +1 mes sin checkout (`status=active`). Crea el plan `Free` (price=0) si no existe. |
| `check-sub.ts` | Imprime el estado actual de la sub de prueba y lo escribe en `<repo>/sub-check.log`. |
| `list-subs.ts` | Lista todas las subscripciones de la company de prueba. |
| `list-plans.ts` | Lista todos los planes (útil para REN-007). |
| `cleanup-sprint-f1.ts` | Restaura la sub a estado limpio (Business / active / period_end=now+30d) y borra el plan Free temporal. Ejecutar al terminar la sesión de pruebas. |

## Flujo recomendado

```bash
# Setup escenario REN-004
npx ts-node -r tsconfig-paths/register scripts/dev/setup-ren-004.ts

# Disparar scan (cron horario sintético)
SKIP_BULL_SETUP=false npx ts-node -r tsconfig-paths/register scripts/dev/force-renewal-scan.ts

# Verificar
npx ts-node -r tsconfig-paths/register scripts/dev/check-sub.ts
cat ../sub-check.log

# Limpieza al final
npx ts-node -r tsconfig-paths/register scripts/dev/cleanup-sprint-f1.ts
```

## Notas

- Si hay un servidor `nest start` corriendo en :3000 con BullMQ activo, **él**
  procesará los jobs (no el script). Los logs aparecen en su consola, no en la
  del script. Asegúrate de tener un único worker activo si quieres trazas
  limpias.
- Para limpiar la queue: `redis-cli FLUSHDB` (cuidado: borra todo Redis).
- El throttle de 6 h en `RenewalSchedulerService` puede ocultar el segundo scan
  consecutivo: limpia `last_renewal_attempt_at` con cualquier `setup-*` antes de
  re-disparar.
