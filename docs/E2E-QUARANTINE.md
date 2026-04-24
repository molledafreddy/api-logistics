# E2E Quarantine — Sprint 21

**Fecha**: 2026-04-24
**Estado**: 9 suites E2E en cuarentena. Renombradas a `*.e2e-spec.ts.skip`.

## Suites afectadas

| Suite         | Path                                          |
| ------------- | --------------------------------------------- |
| App           | `test/app.e2e-spec.ts.skip`                   |
| Admin         | `test/modules/admin.e2e-spec.ts.skip`         |
| Audit         | `test/modules/audit.e2e-spec.ts.skip`         |
| BullMQ        | `test/modules/bullmq.e2e-spec.ts.skip`        |
| Notifications | `test/modules/notifications.e2e-spec.ts.skip` |
| Plans         | `test/modules/plans.e2e-spec.ts.skip`         |
| Relationships | `test/modules/relationships.e2e-spec.ts.skip` |
| Subscriptions | `test/modules/subscriptions.e2e-spec.ts.skip` |
| Verifications | `test/modules/verifications.e2e-spec.ts.skip` |

## Causa raíz

El stack actual de E2E presenta dos bloqueadores estructurales que NO son rentables de
arreglar bajo Supabase Pooler:

1. **Pool exhaustion del Session Pooler de Supabase**
   Cada `createTestApp()` levanta `AppModule` con TypeORM (`max=10` por defecto).
   Aun en `runInBand` con `DB_POOL_MAX=2`, las suites consecutivas no liberan
   conexiones a tiempo y caen con `MaxClientsInSessionMode`.

2. **`WsAuthService` (gateway) instancia `JwksClient` real al boot de `AppModule`**
   `src/gateways/ws-auth.service.ts` crea un cliente JWKS contra Supabase Auth
   incluso en tests. Bajo ts-jest:
   - Hubo bug de interop CJS/ESM (`jwksClient is not a function`) ya resuelto
     usando `import { JwksClient } ... new JwksClient({...})`.
   - Pero el cliente sigue intentando fetch real → cuelgue en runtime cuando la
     red es lenta o el Pooler está saturado.

3. **Síntoma secundario** `Cannot read properties of undefined (reading 'close')`
   en `afterAll(app.close())` cuando `beforeAll` falla y `app` queda `undefined`.
   Mitigado en `test/helpers/test-app.helper.ts::closeTestApp` (helper defensivo
   no usado aún por las suites en cuarentena).

## Plan de reactivación (Sprint 22.5 propuesto)

Cuando se aborde, hacer **en este orden**:

1. **Postgres local en Docker** para tests (no Supabase Pooler):
   - `docker compose -f docker-compose.test.yml up -d` levanta `postgres:16-alpine`.
   - `.env.test` apunta a `localhost:54322`.
   - Migraciones + seed contra el contenedor.

2. **Mock global de `WsAuthService` y `JwksClient`** en `test/setup-e2e.ts`:

   ```ts
   jest.mock('jwks-rsa', () => ({
     JwksClient: jest.fn().mockImplementation(() => ({
       getSigningKey: jest.fn(),
     })),
     passportJwtSecret: jest.fn(() => () => Buffer.from('test-secret')),
   }));
   ```

   Y override del provider en el helper:

   ```ts
   .overrideProvider(WsAuthService).useValue({ verifySocket: jest.fn() })
   ```

3. **Reescribir `closeTestApp` en cada suite**: reemplazar

   ```ts
   afterAll(async () => {
     await app.close();
   });
   ```

   por

   ```ts
   afterAll(async () => {
     await closeTestApp(app);
   });
   ```

4. **Renombrar `.e2e-spec.ts.skip` → `.e2e-spec.ts`** y validar suite por suite.

## Cobertura entre tanto

La suite **unitaria** (`pnpm test`) sigue corriendo full y es lo que cubre CI:

- 270/270 tests verdes (ver `jest.config.cjs`).
- Coverage objetivo Sprint 21: **≥ 70 %** statements/branches en `src/`.
- Reporte: `pnpm test --coverage` → `coverage/lcov-report/index.html`.

## CI

- **Mantener** `pnpm test` en pipeline (unit, ~5 s).
- **Excluir** `pnpm test:e2e` hasta Sprint 22.5.
- El script `test:e2e` queda definido pero no se invoca desde CI.
