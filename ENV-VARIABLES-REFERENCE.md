# 🔐 Referencia Completa de Variables de Entorno

## 📋 Tabla de Contenidos

1. [Variables Requeridas](#variables-requeridas)
2. [Variables Opcionales](#variables-opcionales)
3. [Comparación por Ambiente](#comparación-por-ambiente)
4. [Guía de Configuración](#guía-de-configuración)
5. [Testing en Producción](#testing-en-producción)

---

## 🔴 Variables Requeridas

Estas variables **DEBEN estar presentes** en todos los ambientes o el servidor no iniciará.

### Base de Datos (5 variables)

| Variable      | Tipo   | Descripción                      | Ejemplo                               |
| ------------- | ------ | -------------------------------- | ------------------------------------- |
| `DB_HOST`     | string | Hostname del servidor PostgreSQL | `aws-1-us-east-2.pooler.supabase.com` |
| `DB_NAME`     | string | Nombre de la base de datos       | `postgres`                            |
| `DB_USER`     | string | Usuario de conexión              | `postgres.qnhuwcprctgyhsyyanek`       |
| `DB_PASSWORD` | string | Contraseña de conexión           | `!XCc9q7Zt#Fga6Y`                     |
| `DB_PORT`     | number | Puerto (default: 5432)           | `5432`                                |

### Supabase Auth (4 variables)

| Variable                    | Tipo   | Descripción                     | Requisito     |
| --------------------------- | ------ | ------------------------------- | ------------- |
| `SUPABASE_URL`              | string | URL del proyecto Supabase       | **Requerida** |
| `SUPABASE_ANON_KEY`         | string | JWT token anónimo para clientes | **Requerida** |
| `SUPABASE_SERVICE_ROLE_KEY` | string | JWT token de admin/backend      | **Requerida** |
| `SUPABASE_JWT_SECRET`       | string | Secret para validar/firmar JWTs | **Requerida** |

### Almacenamiento S3/MinIO (3 variables)

| Variable        | Tipo   | Descripción               | Ejemplo                 |
| --------------- | ------ | ------------------------- | ----------------------- |
| `S3_ENDPOINT`   | string | URL del servidor S3/MinIO | `http://localhost:9000` |
| `S3_ACCESS_KEY` | string | Access key de S3          | `minioadmin`            |
| `S3_SECRET_KEY` | string | Secret key de S3          | `minioadmin123`         |

### Email (1 variable)

| Variable    | Tipo   | Descripción             | Ejemplo     |
| ----------- | ------ | ----------------------- | ----------- |
| `MAIL_HOST` | string | Servidor SMTP o mailhog | `localhost` |

### Pagos Stripe (3 variables)

| Variable                 | Tipo   | Descripción            | Ejemplo Dev    | Ejemplo Prod   |
| ------------------------ | ------ | ---------------------- | -------------- | -------------- |
| `STRIPE_SECRET_KEY`      | string | Secret key de Stripe   | `sk_test_*`    | `sk_live_*`    |
| `STRIPE_WEBHOOK_SECRET`  | string | Webhook signing secret | `whsec_test_*` | `whsec_live_*` |
| `STRIPE_PUBLISHABLE_KEY` | string | Publishable key        | `pk_test_*`    | `pk_live_*`    |

---

## 🟡 Variables Opcionales

Estas variables tienen valores por defecto y pueden estar vacías.

### JWT Legacy (Deprecated - Supabase maneja auth)

```bash
JWT_PRIVATE_KEY=                    # Puede estar vacío
JWT_PUBLIC_KEY=                     # Puede estar vacío
JWT_ACCESS_TOKEN_TTL=900            # Default: 900 seg (15 min)
JWT_REFRESH_TOKEN_TTL=604800        # Default: 604800 seg (7 días)
```

### Email Opcionales

```bash
MAIL_USER=                          # Usuario SMTP (vacío si no auth)
MAIL_PASSWORD=                      # Contraseña SMTP (vacío si no auth)
MAIL_PORT=1025                      # Default: 1025
MAIL_FROM=noreply@api-logistics.com # Default
MAIL_FROM_NAME=API Logistics        # Default
```

### Firebase (Todos opcionales)

```bash
FIREBASE_PROJECT_ID=                # Vacío si no se usa Firebase
FIREBASE_PRIVATE_KEY=               # Vacío si no se usa Firebase
FIREBASE_CLIENT_EMAIL=              # Vacío si no se usa Firebase
```

### Sentry (Observabilidad opcional)

```bash
SENTRY_DSN=                         # Vacío si no se usa Sentry
SENTRY_TRACES_SAMPLE_RATE=0.1       # Default: 0.1 (10%)
SENTRY_PROFILES_SAMPLE_RATE=0       # Default: 0 (disabled)
```

### Seeds (CLI scripts, no afecta tests)

```bash
SUPER_ADMIN_EMAIL=admin@logistics-api.com
SUPER_ADMIN_PASSWORD=SuperAdmin1!@#
SEED_DEMO=false                     # Active demo seeds (default: false)
```

### Redis

```bash
REDIS_HOST=localhost                # Default: localhost
REDIS_PORT=6379                     # Default: 6379
REDIS_PASSWORD=                     # Default: vacío
REDIS_TLS=false                     # Default: false
```

---

## 🟢 Variables con Defaults Sensatos

Estas variables tienen valores por defecto razonables.

### Aplicación

```bash
NODE_ENV=development                # Valores: development|test|staging|production
APP_PORT=3000                       # Default: 3000
APP_URL=http://localhost:3000       # Default: http://localhost:3000
APP_NAME=API-Logistics              # Default: API-Logistics
APP_VERSION=1.0.0                   # Default: 1.0.0
API_PREFIX=v1                       # Default: v1
CORS_ORIGINS=http://localhost:3001  # Default: http://localhost:3001
```

### Base de Datos (Opcionales)

```bash
DB_SSL=false                        # Default: false
DB_LOGGING=false                    # Default: false
DB_SYNCHRONIZE=false                # Default: false (NUNCA true en prod)
DB_POOL_MIN=2                       # Default: 2
DB_POOL_MAX=10                      # Default: 10
```

### S3/MinIO (Buckets)

```bash
S3_REGION=us-east-1                 # Default: us-east-1
S3_BUCKET_AVATARS=logistics-avatars
S3_BUCKET_DOCUMENTS=logistics-documents
S3_BUCKET_RECEIPTS=logistics-receipts
S3_BUCKET_CHAT=logistics-chat
S3_BUCKET_EXPORTS=logistics-exports
S3_FORCE_PATH_STYLE=true            # Default: true
```

### Rate Limiting

```bash
THROTTLE_SHORT_TTL=1000             # Short window: 1 segundo
THROTTLE_SHORT_LIMIT=10             # Max 10 req en 1s
THROTTLE_TTL=60000                  # Medium window: 60 segundos
THROTTLE_LIMIT=100                  # Max 100 req en 60s
THROTTLE_LONG_TTL=3600000           # Long window: 1 hora
THROTTLE_LONG_LIMIT=1000            # Max 1000 req en 1h
```

### Body Limits

```bash
MAX_REQUEST_BODY_SIZE=1mb           # Default: 1mb
MAX_FILE_UPLOAD_SIZE=25mb           # Default: 25mb
```

### Logging

```bash
LOG_LEVEL=debug                     # Valores: error|warn|info|debug|verbose
LOG_FORMAT=pretty                   # Valores: json|pretty
```

### Testing

```bash
E2E_TEST=false                      # Default: false
DATABASE_URL=                       # Legacy, opcional
```

---

## 📊 Comparación por Ambiente

### Tabla Resumida

| Variable       | Development      | Test           | Production   |
| -------------- | ---------------- | -------------- | ------------ |
| `DB_HOST`      | Supabase pooler  | localhost      | Cloud DB     |
| `DB_PORT`      | 5432             | 5433           | 5432         |
| `DB_NAME`      | postgres         | logistics_test | postgres     |
| `DB_USER`      | postgres.qnhu... | test           | prod_user    |
| `DB_SSL`       | true             | false          | true         |
| `DB_LOGGING`   | true             | false          | false        |
| `REDIS_HOST`   | localhost        | localhost      | Redis Cloud  |
| `REDIS_PORT`   | 6379             | 6380           | 6379         |
| `SUPABASE_URL` | Real             | Dummy          | Real         |
| `STRIPE_*`     | sk*test*\*       | sk*test*\*     | sk*live*\*   |
| `MAIL_HOST`    | localhost        | localhost      | SendGrid/SES |
| `LOG_LEVEL`    | debug            | error          | warn         |

---

## 🛠️ Guía de Configuración

### Ambiente: Development

**Archivo:** `.env.development`

```bash
# Base de datos: Supabase PostgreSQL
DB_HOST=aws-1-us-east-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.qnhuwcprctgyhsyyanek
DB_PASSWORD=your-real-password
DB_SSL=true
DB_LOGGING=true

# Supabase: Credenciales reales
SUPABASE_URL=https://qnhuwcprctgyhsyyanek.supabase.co
SUPABASE_ANON_KEY=eyJ...real-token...
SUPABASE_SERVICE_ROLE_KEY=eyJ...real-token...
SUPABASE_JWT_SECRET=z6t...real-secret...

# S3/MinIO: Local
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Email: Mailhog (local)
MAIL_HOST=localhost
MAIL_PORT=1025

# Stripe: Test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Ambiente: Test (CI/CD)

**Archivo:** `.env.test`

```bash
# Base de datos: PostgreSQL local (docker-compose.test.yml)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=logistics_test
DB_USER=test
DB_PASSWORD=test
DB_SSL=false
DB_LOGGING=false

# Supabase: DUMMY (seeds se skipped en CI/CD)
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=eyJ...dummy...
SUPABASE_SERVICE_ROLE_KEY=eyJ...dummy...
SUPABASE_JWT_SECRET=test-dummy-secret

# JWT: Test values
JWT_ACCESS_SECRET=test-access-secret-key-for-e2e-testing-12345
JWT_REFRESH_SECRET=test-refresh-secret-key-for-e2e-testing-67890

# S3/MinIO: Local
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Email: Mailhog (local)
MAIL_HOST=localhost
MAIL_PORT=1025

# Stripe: Test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Logging
LOG_LEVEL=error
LOG_FORMAT=pretty
```

### Ambiente: Production

**Variables configuradas en:**

- AWS Systems Manager Parameter Store
- GitHub Secrets (para CI/CD)
- Docker environment variables

```bash
# Base de datos: RDS/Aurora
DB_HOST=api-logistics-prod.c9akciq32.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=logistics_prod
DB_USER=prod_master_user
DB_PASSWORD=very-strong-password-change-me
DB_SSL=true
DB_LOGGING=false

# Supabase: Credenciales reales de producción
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=eyJ...real-prod-token...
SUPABASE_SERVICE_ROLE_KEY=eyJ...real-prod-token...
SUPABASE_JWT_SECRET=z6t...real-prod-secret...

# Redis: Redis Cloud o ElastiCache
REDIS_HOST=api-logistics-prod.redis.aws.com
REDIS_PORT=6379
REDIS_PASSWORD=redis-prod-password
REDIS_TLS=true

# S3: AWS S3 bucket
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_REGION=us-east-1
S3_BUCKET_AVATARS=logistics-prod-avatars
S3_BUCKET_DOCUMENTS=logistics-prod-documents
S3_BUCKET_RECEIPTS=logistics-prod-receipts
S3_BUCKET_CHAT=logistics-prod-chat
S3_BUCKET_EXPORTS=logistics-prod-exports

# Email: SendGrid o AWS SES
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASSWORD=SG.very-long-api-key...
MAIL_FROM=noreply@yourdomain.com
MAIL_FROM_NAME=Logistics API

# Stripe: LIVE keys (no test!)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Sentry: Error tracking
SENTRY_DSN=https://xxx@sentry.io/123456
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Logging
LOG_LEVEL=warn
LOG_FORMAT=json
```

---

## ⚠️ Testing en Producción

### ❌ NO hagas esto

```bash
# NUNCA ejecutes E2E tests en producción
npm run test:e2e  # ← NO en prod

# NUNCA uses NODE_ENV=test en prod
NODE_ENV=test npm start  # ← NO en prod
```

### ❌ Por qué no

1. **Datos corrompidos**: Los tests crean/modifican/borran datos reales
2. **Migraciones**: Pueden alterar el schema en vivo
3. **Carga de base de datos**: Agrega stress innecesario
4. **Costos**: Stripe intenta procesar pagos (si llegan a ese punto)
5. **Emails**: Se envían emails reales a directorios de prueba

### ✅ La forma correcta

```bash
# 1. Tests en CI/CD (GitHub Actions) - antes de deploy
#    Automáticamente en cada push a main

# 2. Tests en staging environment (si existe)
#    Ambiente de pre-producción con datos reales simulados
NODE_ENV=staging npm run test:e2e

# 3. Smoke tests manuales en producción
#    Solo endpoints públicos, sin modificaciones
curl https://api.yourdomain.com/api/v1/health

# 4. Monitoreo en vivo
#    Sentry para errores
#    CloudWatch para logs
#    Datadog para performance
```

---

## 📝 Checklist de Configuración

### Para Development

- [ ] `.env.development` creado con credenciales locales
- [ ] Supabase: Credenciales reales de desarrollo
- [ ] PostgreSQL: Corriendo en Supabase o localmente
- [ ] Redis: Corriendo en localhost:6379
- [ ] MinIO: Corriendo en localhost:9000
- [ ] Mailhog: Corriendo en localhost:1025

### Para CI/CD (GitHub Actions)

- [ ] `.env.test` creado con valores dummy/locales
- [ ] GitHub Secrets NO incluyen credenciales reales
- [ ] PostgreSQL de test: Docker en runner
- [ ] Redis de test: Docker en runner
- [ ] Supabase URLs: Dummy (no se conecta)
- [ ] Seeds: Skip automáticamente en CI/CD

### Para Producción

- [ ] Variables en AWS Systems Manager Parameter Store
- [ ] GitHub Secrets actualizados con claves live
- [ ] Database: RDS/Aurora configurada
- [ ] Redis: Redis Cloud o ElastiCache
- [ ] S3: AWS S3 buckets creados
- [ ] Stripe: Live keys (NO test keys)
- [ ] Email: SendGrid o SES configurado
- [ ] Sentry: Project creado y DSN configurado
- [ ] Logs: JSON format en CloudWatch
- [ ] Backups: Automáticos habilitados

---

## 🔍 Validación de Variables

Para verificar que todas las variables requeridas están presentes:

```bash
# Development
npm run build -- --env .env.development

# Test
NODE_ENV=test npm run build

# Production
NODE_ENV=production npm run build
```

Si falta alguna variable requerida, verás un error como:

```
Config validation error: "SUPABASE_ANON_KEY" is required
```

---

## 📚 Referencias Adicionales

- **Validation Schema**: `src/config/validation.schema.ts`
- **Config Files**: `src/config/*.config.ts`
- **App Module**: `src/app.module.ts` (línea 70-103)
- **Seeds**: `src/database/seeds/run-seed.ts`

---

**Última actualización**: 27 de Abril de 2026
**Versión de app**: 1.0.0
