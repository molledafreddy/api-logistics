# Postman Collection — API Logistics

Colección y environment **generados automáticamente** desde `docs/openapi.json` por
[`scripts/openapi/generate-postman.ts`](../../scripts/openapi/generate-postman.ts).

> ⚠️ **No edites estos archivos a mano.** Se regeneran con cada cambio del spec.
> Si necesitas añadir requests personalizadas, créalas en una colección aparte
> (p. ej. `local-dev.postman_collection.json`).

---

## 📦 Contenido

| Archivo                                  | Descripción                                                        |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `api-logistics.postman_collection.json`  | 178 requests organizadas en 24 carpetas (una por tag OpenAPI)      |
| `api-logistics.postman_environment.json` | Environment con `baseUrl`, `jwt` (secret), `refreshToken` (secret) |

---

## 🚀 Cómo importar

1. Abre Postman → **Import** (botón superior izquierdo).
2. Arrastra los **dos** archivos de esta carpeta.
3. En el selector de environment (esquina superior derecha) elige
   **"API Logistics v0.0.1 - Local"**.
4. Asegúrate de tener la API corriendo localmente:
   ```bash
   pnpm start:dev
   ```
   Por defecto la colección apunta a `http://localhost:3000/api/v1`.

---

## 🔐 Workflow de autenticación

La colección usa **Bearer auth a nivel raíz** con la variable `{{jwt}}`,
así que **todas las requests heredan** el header `Authorization: Bearer {{jwt}}`.

### Login automático

Las requests **`POST /auth/login`** y **`POST /auth/refresh`** tienen un
test script que **extrae el token del response y lo guarda automáticamente**
en el environment:

```js
// Se ejecuta tras cada login/refresh
const json = pm.response.json();
const access = json.accessToken || json.access_token || json.token;
const refresh = json.refreshToken || json.refresh_token;
if (access) pm.environment.set('jwt', access);
if (refresh) pm.environment.set('refreshToken', refresh);
```

**Workflow típico**:

1. **Auth → Login** con tus credenciales → `{{jwt}}` queda poblado.
2. Cualquier otra request usa ese token automáticamente.
3. Si el token caduca → ejecuta **Auth → Refresh** y vuelve a estar autenticado.

### Endpoints públicos

Los siguientes endpoints están marcados como `noauth` (no envían el header):

- `GET /` (root)
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /users/accept-invite`

---

## 🧩 Estructura de cada request

| Campo              | Origen                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **URL**            | `{{baseUrl}}` + path con `:param`                                                                             |
| **Path variables** | Auto-extraídos de `{param}` en la ruta                                                                        |
| **Query params**   | Marcados como `disabled` por defecto (actívalos en la pestaña Params)                                         |
| **Body**           | Ejemplo JSON generado desde el `requestBody.schema` (resuelve `$ref`, usa `format` para uuid/email/date-time) |
| **Headers**        | Solo los declarados en el spec; `Content-Type: application/json` se añade si hay body                         |

---

## 🔄 Regenerar la colección

```bash
# Solo Postman (asume que docs/openapi.json ya está actualizado)
pnpm openapi:postman

# Pipeline completo: spec + audit + Postman
pnpm openapi:full
```

Tras regenerar, Postman detectará el cambio y te ofrecerá **re-importar**.
Tu environment local (con tokens guardados) **no se sobrescribe**, solo la colección.

---

## 🌐 Variables disponibles

| Variable       | Default                        | Tipo    | Notas                      |
| -------------- | ------------------------------ | ------- | -------------------------- |
| `baseUrl`      | `http://localhost:3000/api/v1` | default | Cámbiala para staging/prod |
| `jwt`          | _(vacío)_                      | secret  | Se rellena al hacer login  |
| `refreshToken` | _(vacío)_                      | secret  | Se rellena al hacer login  |

### Ejemplos de `baseUrl` por entorno

```
local    → http://localhost:3000/api/v1
staging  → https://staging.api-logistics.com/api/v1
prod     → https://api.api-logistics.com/api/v1
```

> 💡 Crea **un environment por entorno** y duplica el local cambiando solo `baseUrl`.

---

## 🧪 Newman (CI / smoke tests)

Puedes correr la colección en CI con [Newman](https://github.com/postmanlabs/newman):

```bash
# Una sola vez
pnpm dlx newman run docs/postman/api-logistics.postman_collection.json \
  -e docs/postman/api-logistics.postman_environment.json \
  --folder "Auth" \
  --env-var "baseUrl=http://localhost:3000/api/v1"
```

---

## 📚 Referencias

- Spec OpenAPI: [`../openapi.json`](../openapi.json)
- Audit del spec: [`../openapi-audit.md`](../openapi-audit.md)
- Generador: [`../../scripts/openapi/generate-postman.ts`](../../scripts/openapi/generate-postman.ts)
