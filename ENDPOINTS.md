# API Logistics — Documentación de Endpoints

Documentación completa de todos los servicios y endpoints disponibles en la API.

## 📍 Acceso a Swagger

La documentación interactiva está disponible en:

```
GET http://localhost:3000/api/docs
```

---

## 🔐 Autenticación

Todos los endpoints (excepto algunos públicos) requieren header:

```
Authorization: Bearer <access_token>
```

Obtén el token en `/auth/login`:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

---

## 📋 Servicios y Endpoints

### 🔐 Auth

| Método | Endpoint                  | Descripción                            | Autenticado |
| ------ | ------------------------- | -------------------------------------- | ----------- |
| POST   | `/auth/register`          | Registrar nuevo usuario y empresa      | No          |
| POST   | `/auth/login`             | Login con email/contraseña             | No          |
| POST   | `/auth/refresh`           | Refrescar access token                 | No          |
| POST   | `/auth/logout`            | Cerrar sesión                          | ✅ Sí       |
| GET    | `/auth/me`                | Obtener perfil del usuario autenticado | ✅ Sí       |
| POST   | `/auth/resend-email`      | Re-enviar email de verificación        | ✅ Sí       |
| POST   | `/auth/sync-email-status` | Sincronizar estado de email            | ✅ Sí       |

---

### 🏢 Companies

| Método | Endpoint         | Descripción             | Roles              | Autenticado |
| ------ | ---------------- | ----------------------- | ------------------ | ----------- |
| GET    | `/companies`     | Listar empresas         | Todos              | ✅ Sí       |
| GET    | `/companies/:id` | Obtener empresa por ID  | Todos              | ✅ Sí       |
| POST   | `/companies`     | Crear empresa           | SUPER_ADMIN        | ✅ Sí       |
| PATCH  | `/companies/:id` | Actualizar empresa      | SUPER_ADMIN, Owner | ✅ Sí       |
| DELETE | `/companies/:id` | Eliminar empresa (soft) | SUPER_ADMIN        | ✅ Sí       |

---

### 👥 Users (Team)

| Método | Endpoint                | Descripción                   | Roles        | Autenticado |
| ------ | ----------------------- | ----------------------------- | ------------ | ----------- |
| GET    | `/users`                | Listar usuarios de la empresa | Todos        | ✅ Sí       |
| GET    | `/users/:id`            | Obtener usuario por ID        | Todos        | ✅ Sí       |
| POST   | `/users/invite`         | Invitar usuario al equipo     | OWNER, ADMIN | ✅ Sí       |
| POST   | `/users/accept-invite`  | Aceptar invitación            | No           | ❌ No       |
| PUT    | `/users/:id`            | Actualizar datos de usuario   | Propietario  | ✅ Sí       |
| PUT    | `/users/:id/role`       | Cambiar rol de usuario        | OWNER, ADMIN | ✅ Sí       |
| DELETE | `/users/:id`            | Desactivar usuario            | OWNER, ADMIN | ✅ Sí       |
| POST   | `/users/:id/reactivate` | Reactivar usuario             | OWNER, ADMIN | ✅ Sí       |

---

### 📅 Plans

| Método | Endpoint                 | Descripción                 | Roles       | Autenticado |
| ------ | ------------------------ | --------------------------- | ----------- | ----------- |
| GET    | `/plans`                 | Listar planes               | Todos       | ✅ Sí       |
| GET    | `/plans/:id`             | Obtener plan por ID         | Todos       | ✅ Sí       |
| POST   | `/plans`                 | Crear plan                  | SUPER_ADMIN | ✅ Sí       |
| PATCH  | `/plans/:id`             | Actualizar plan             | SUPER_ADMIN | ✅ Sí       |
| DELETE | `/plans/:id`             | Eliminar plan               | SUPER_ADMIN | ✅ Sí       |
| GET    | `/plans/permissions`     | Listar permisos disponibles | Todos       | ✅ Sí       |
| GET    | `/plans/permissions/:id` | Obtener permiso por ID      | Todos       | ✅ Sí       |
| POST   | `/plans/permissions`     | Crear permiso               | SUPER_ADMIN | ✅ Sí       |
| PATCH  | `/plans/permissions/:id` | Actualizar permiso          | SUPER_ADMIN | ✅ Sí       |
| DELETE | `/plans/permissions/:id` | Eliminar permiso            | SUPER_ADMIN | ✅ Sí       |
| POST   | `/plans/:id/permissions` | Asignar permiso a plan      | SUPER_ADMIN | ✅ Sí       |

---

### 💳 Subscriptions

| Método | Endpoint                                | Descripción                      | Autenticado |
| ------ | --------------------------------------- | -------------------------------- | ----------- |
| GET    | `/subscriptions`                        | Listar suscripciones por empresa | ✅ Sí       |
| POST   | `/subscriptions/free`                   | Crear suscripción gratuita       | ✅ Sí       |
| PATCH  | `/subscriptions/:id/cancel`             | Cancelar suscripción             | ✅ Sí       |
| PATCH  | `/subscriptions/:id/upgrade`            | Upgrade de suscripción           | ✅ Sí       |
| PATCH  | `/subscriptions/:id/downgrade`          | Downgrade de suscripción         | ✅ Sí       |
| PATCH  | `/subscriptions/:id/suspend`            | Suspender suscripción            | ✅ Sí       |
| POST   | `/subscriptions/:id/addons`             | Agregar addon                    | ✅ Sí       |
| GET    | `/subscriptions/:id/addons`             | Listar addons                    | ✅ Sí       |
| GET    | `/subscriptions/addons/:addonId`        | Obtener addon por ID             | ✅ Sí       |
| PATCH  | `/subscriptions/addons/:addonId`        | Actualizar addon                 | ✅ Sí       |
| PATCH  | `/subscriptions/addons/:addonId/delete` | Eliminar addon                   | ✅ Sí       |

---

### ✅ Verifications (KYC)

| Método | Endpoint                            | Descripción                      | Roles       | Autenticado |
| ------ | ----------------------------------- | -------------------------------- | ----------- | ----------- |
| GET    | `/verifications/tiers`              | Listar niveles de verificación   | Todos       | ✅ Sí       |
| POST   | `/verifications/tiers`              | Crear nivel (admin)              | SUPER_ADMIN | ✅ Sí       |
| POST   | `/verifications`                    | Crear solicitud de verificación  | Todos       | ✅ Sí       |
| GET    | `/verifications/company/:companyId` | Listar verificaciones de empresa | Todos       | ✅ Sí       |
| GET    | `/verifications/:id`                | Obtener verificación por ID      | Todos       | ✅ Sí       |
| PATCH  | `/verifications/:id/submit`         | Enviar para revisión             | Todos       | ✅ Sí       |
| PATCH  | `/verifications/:id/review`         | Revisar (admin)                  | SUPER_ADMIN | ✅ Sí       |
| POST   | `/verifications/:id/documents`      | Agregar documento                | Todos       | ✅ Sí       |
| GET    | `/verifications/:id/documents`      | Listar documentos                | Todos       | ✅ Sí       |

---

### 🤝 Relationships

| Método | Endpoint                            | Descripción                   | Autenticado |
| ------ | ----------------------------------- | ----------------------------- | ----------- |
| POST   | `/relationships`                    | Crear invitación de relación  | ✅ Sí       |
| GET    | `/relationships/company/:companyId` | Listar relaciones de empresa  | ✅ Sí       |
| GET    | `/relationships/:id`                | Obtener relación por ID       | ✅ Sí       |
| PATCH  | `/relationships/:id/respond`        | Aceptar/rechazar invitación   | ✅ Sí       |
| PATCH  | `/relationships/:id/terminate`      | Terminar relación             | ✅ Sí       |
| GET    | `/relationships/:id/logs`           | Obtener historial de relación | ✅ Sí       |

---

### 📁 Files (S3)

| Método | Endpoint              | Descripción                         | Autenticado |
| ------ | --------------------- | ----------------------------------- | ----------- |
| POST   | `/files/upload-url`   | Generar URL de carga pre-firmada    | ✅ Sí       |
| GET    | `/files/download-url` | Generar URL de descarga pre-firmada | ✅ Sí       |
| DELETE | `/files`              | Eliminar archivo (query: `key`)     | ✅ Sí       |

---

### 📊 Audit Logs

| Método | Endpoint                       | Descripción                  | Roles              | Autenticado |
| ------ | ------------------------------ | ---------------------------- | ------------------ | ----------- |
| GET    | `/audit/company/:companyId`    | Logs de auditoría de empresa | ADMIN, SUPER_ADMIN | ✅ Sí       |
| GET    | `/audit/:entityType/:entityId` | Logs de recurso específico   | ADMIN, SUPER_ADMIN | ✅ Sí       |

---

### 🔔 Notifications

| Método | Endpoint                            | Descripción                    | Autenticado |
| ------ | ----------------------------------- | ------------------------------ | ----------- |
| GET    | `/notifications`                    | Mis notificaciones (paginated) | ✅ Sí       |
| PATCH  | `/notifications/:id/read`           | Marcar como leído              | ✅ Sí       |
| PATCH  | `/notifications/read-all`           | Marcar todas como leídas       | ✅ Sí       |
| POST   | `/notifications/push-tokens`        | Registrar token de push        | ✅ Sí       |
| DELETE | `/notifications/push-tokens/:token` | Desactivar token de push       | ✅ Sí       |

---

### 🔧 Admin

| Método | Endpoint               | Descripción               | Roles       | Autenticado |
| ------ | ---------------------- | ------------------------- | ----------- | ----------- |
| GET    | `/admin/dashboard`     | Stats generales           | SUPER_ADMIN | ✅ Sí       |
| GET    | `/admin/companies`     | Listar todas las empresas | SUPER_ADMIN | ✅ Sí       |
| GET    | `/admin/companies/:id` | Detalles de empresa       | SUPER_ADMIN | ✅ Sí       |
| PATCH  | `/admin/companies/:id` | Actualizar empresa        | SUPER_ADMIN | ✅ Sí       |
| GET    | `/admin/subscriptions` | Listar suscripciones      | SUPER_ADMIN | ✅ Sí       |
| GET    | `/admin/verifications` | Listar verificaciones     | SUPER_ADMIN | ✅ Sí       |

---

## 📊 Modelos de Datos

### Company

```json
{
  "id": "uuid",
  "name": "string",
  "legalName": "string",
  "taxId": "string",
  "companyType": "carrier|shipper|broker",
  "status": "active|inactive|suspended",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### User

```json
{
  "id": "uuid",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "role": "super_admin|company_owner|admin|manager|dispatcher|driver|accountant|viewer",
  "companyId": "uuid",
  "isActive": "boolean",
  "createdAt": "ISO-8601"
}
```

### Verification

```json
{
  "id": "uuid",
  "companyId": "uuid",
  "tierId": "uuid",
  "status": "pending|in_review|approved|rejected",
  "submittedAt": "ISO-8601 | null",
  "reviewedAt": "ISO-8601 | null",
  "approvedAt": "ISO-8601 | null",
  "expiresAt": "ISO-8601 | null",
  "createdAt": "ISO-8601"
}
```

### Subscription

```json
{
  "id": "uuid",
  "companyId": "uuid",
  "planId": "uuid",
  "status": "active|cancelled|suspended|expired",
  "startDate": "ISO-8601",
  "endDate": "ISO-8601 | null",
  "createdAt": "ISO-8601"
}
```

---

## 🔍 Ejemplos de Request

### Crear Empresa

```bash
curl -X POST http://localhost:3000/companies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Logistics",
    "legalName": "ACME S.A.",
    "taxId": "123456789",
    "companyType": "carrier"
  }'
```

### Crear Suscripción Gratuita

```bash
curl -X POST http://localhost:3000/subscriptions/free \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "<company-uuid>",
    "planId": "<plan-uuid>"
  }'
```

### Crear Relación Comercial

```bash
curl -X POST http://localhost:3000/relationships \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentCompanyId": "<parent-uuid>",
    "childCompanyId": "<child-uuid>",
    "relationshipType": "covered_carrier",
    "invitationEmail": "admin@child-company.com"
  }'
```

### Solicitar Verificación

```bash
curl -X POST http://localhost:3000/verifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "<company-uuid>",
    "tierId": "<tier-uuid>"
  }'
```

### Obtener URL de Carga S3

```bash
curl -X POST http://localhost:3000/files/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "folder": "verifications/documents",
    "filename": "license.pdf",
    "contentType": "application/pdf"
  }'
```

---

## ⚙️ Códigos de Estado

| Código  | Significado                                |
| ------- | ------------------------------------------ |
| **200** | OK — Request exitoso                       |
| **201** | Created — Recurso creado                   |
| **204** | No Content — Eliminar exitoso              |
| **400** | Bad Request — Parámetros inválidos         |
| **401** | Unauthorized — Token inválido o expirado   |
| **403** | Forbidden — Permisos insuficientes         |
| **404** | Not Found — Recurso no encontrado          |
| **409** | Conflict — Recurso duplicado               |
| **500** | Internal Server Error — Error del servidor |

---

## 🔐 Roles y Permisos

### Roles Disponibles

- **SUPER_ADMIN** — Acceso total al sistema
- **COMPANY_OWNER** — Owner de la empresa, gestión de usuarios
- **ADMIN** — Administrador de empresa, revisor de verificaciones
- **MANAGER** — Gestor de operaciones
- **DISPATCHER** — Gestor de rutas/envíos
- **DRIVER** — Conductor
- **ACCOUNTANT** — Contador
- **VIEWER** — Solo lectura

---

## 📈 Rate Limiting

El API implementa rate limiting global:

- **TTL:** 60 segundos
- **Límite:** 1000 requests

El servidor retornará `429 Too Many Requests` si se excede el límite.

---

## 🔗 Referencias

- [NestJS Docs](https://docs.nestjs.com)
- [Swagger/OpenAPI Docs](https://swagger.io/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [AWS S3 API](https://docs.aws.amazon.com/s3/)

---

**Última actualización:** Abril 20, 2026
