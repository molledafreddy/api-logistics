# 🔍 Análisis y Recomendaciones - Error de Configuración en CI/CD

**Fecha:** 27 de Abril de 2026  
**Estado:** Problema identificado - Listo para implementación  
**Prioridad:** Alta (bloquea CI/CD)

---

## 📋 Resumen Ejecutivo

El error de validación de configuración ocurre porque **faltan variables de entorno en el workflow de GitHub Actions**. El archivo `.env.test` está en `.gitignore` (correcto por seguridad), pero las variables dummy necesarias no están declaradas en la sección `env:` del workflow.

### Error Original

```
Config validation error:
  "SUPABASE_ANON_KEY" is required
  "S3_ENDPOINT" is required
  "S3_ACCESS_KEY" is required
  "S3_SECRET_KEY" is required
  "MAIL_HOST" is required
  "STRIPE_SECRET_KEY" is required
  "STRIPE_WEBHOOK_SECRET" is required
  "STRIPE_PUBLISHABLE_KEY" is required
```

---

## 🔬 Raíz del Problema

### Cómo NestJS Carga Configuración

```typescript
// src/app.module.ts (línea 77)
ConfigModule.forRoot({
  envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
  validationSchema,
  // ...
});
```

**Flujo:**

1. `NODE_ENV=test` (seteado en CI/CD)
2. NestJS busca `.env.test`
3. Lee variables del archivo
4. **Sobrescribe** con variables de `process.env`
5. Valida contra `validationSchema`

### El Problema

- ✅ `.github/workflows/ci.yml` declara algunas variables (DATABASE, REDIS, JWT)
- ❌ **.env.test está en `.gitignore`** → no existe en CI/CD
- ❌ Faltan 8 variables requeridas en el workflow `env:`
- ❌ NestJS no puede cargar las variables faltantes
- ❌ Validación falla

---

## 💡 Opciones de Solución

### Opción 1️⃣: Agregar Variables al Workflow (RECOMENDADA)

**Ventajas:**

- ✅ Solución más simple y directa
- ✅ No requiere cambios de código
- ✅ Variables dummy son seguras (no credenciales reales)
- ✅ Mantiene `.env.test` en `.gitignore` (buena práctica)
- ✅ Sigue convención de GitHub Actions

**Desventajas:**

- ⚠️ Workflow se vuelve más largo
- ⚠️ Requiere mantener sincronizado con `validationSchema`

**Implementación:**
Agregar 8 variables a `.github/workflows/ci.yml` sección `env:`

```yaml
SUPABASE_ANON_KEY: eyJ...dummy-anon-key...
S3_ENDPOINT: http://localhost:9000
S3_ACCESS_KEY: minioadmin
S3_SECRET_KEY: minioadmin123
MAIL_HOST: localhost
STRIPE_SECRET_KEY: sk_test_placeholder
STRIPE_WEBHOOK_SECRET: whsec_placeholder
STRIPE_PUBLISHABLE_KEY: pk_test_placeholder
```

---

### Opción 2️⃣: Hacer Variables Opcionales

**Ventajas:**

- ✅ Limpia el `validationSchema`
- ✅ Menos variables en el workflow

**Desventajas:**

- ❌ Cambia arquitectura de validación
- ❌ Algunos servicios podrían fallar en runtime si faltan dependencias
- ❌ Riesgoso para production

**No Recomendado** para esta fase

---

### Opción 3️⃣: Versionear `.env.test`

**Ventajas:**

- ✅ `.env.test` sempre disponible
- ✅ Más fácil de mantener

**Desventajas:**

- ❌ `.env.test` sería versionado en git
- ❌ Riesgo de exponer secretos accidentalmente
- ❌ Rompe convención de seguridad

**No Recomendado**

---

### Opción 4️⃣ & 5️⃣: Archivos Específicos para CI

Requieren cambios en `ConfigModule` y agregan complejidad innecesaria.

**No Recomendado** para esta fase

---

## 🎯 Recomendación Final

**Implementar OPCIÓN 1: Agregar variables dummy al workflow CI/CD**

### Razones:

1. **Más simple** - Un solo cambio en un archivo
2. **Seguro** - Variables son dummy, no credenciales reales
3. **Mantenible** - Fácil auditar qué variables tiene CI/CD
4. **Alineado** - Sigue convención de GitHub Actions
5. **Probado** - Patrón común en proyectos NestJS

---

## 🚫 Sobre Conectar a Supabase Real

### Pregunta: ¿Debemos agregar credenciales reales de Supabase?

**Respuesta: NO, por ahora no**

### Razones:

1. **Aislamiento de tests** - CI/CD debe ser independiente
2. **Seguridad** - Credenciales en logs públicos de GitHub
3. **Performance** - Tests serían lentos (sin Docker local)
4. **Rate limiting** - Riesgo de alcanzar límites de Supabase
5. **Confiabilidad** - Tests no deben depender de servicios externos

### Estrategia Correcta:

**AHORA (Sprint 26):**

- ✅ Tests con variables dummy
- ✅ PostgreSQL local en Docker (5433)
- ✅ Redis local en Docker (6380)
- ✅ Supabase seeds skipped (esperado)
- ✅ Tests rápidos (~6 segundos)
- ✅ 100% reproducible

**FUTURO (Sprint 27+):**

- Considerar tests en staging con BD compartida
- O implementar Supabase local en Docker (complejo)
- O tests E2E separados que SÍ usen Supabase real

---

## 📝 Plan de Implementación

### Paso 1: Actualizar `.github/workflows/ci.yml`

Agregar 8 variables a la sección `env:` bajo el job `test`:

```yaml
test:
  name: 🧪 Run Unit & E2E Tests
  runs-on: ubuntu-latest

  services:
    postgres:
      # ... (existente)
    redis:
      # ... (existente)

  env:
    # Existentes (DATABASE, REDIS, JWT, etc.)
    NODE_ENV: test
    CI: 'true'
    # ... (resto de variables)

    # NUEVAS VARIABLES:
    SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test
    S3_ENDPOINT: http://localhost:9000
    S3_ACCESS_KEY: minioadmin
    S3_SECRET_KEY: minioadmin123
    MAIL_HOST: localhost
    STRIPE_SECRET_KEY: sk_test_placeholder
    STRIPE_WEBHOOK_SECRET: whsec_placeholder
    STRIPE_PUBLISHABLE_KEY: pk_test_placeholder
```

### Paso 2: Verificar Localmente

```bash
# Establecer variables locales
export NODE_ENV=test
export SUPABASE_ANON_KEY="eyJ..."
# ... (resto de variables)

# Ejecutar tests
npm run test:e2e
```

### Paso 3: Push y Validación

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): add missing dummy env variables for configuration validation"
git push origin main
```

### Paso 4: Monitorear

- Verificar que CI/CD ejecute sin errores de validación
- Confirmar que 671 tests ejecuten correctamente
- Validar que seeds se skippeen con warnings (esperado)

---

## 📊 Comparación: Antes vs Después

### Antes

```
❌ SUPABASE_ANON_KEY: undefined
❌ S3_ENDPOINT: undefined
❌ S3_ACCESS_KEY: undefined
❌ S3_SECRET_KEY: undefined
❌ MAIL_HOST: undefined
❌ STRIPE_SECRET_KEY: undefined
❌ STRIPE_WEBHOOK_SECRET: undefined
❌ STRIPE_PUBLISHABLE_KEY: undefined

Result: Config validation error ❌
Tests: Never run ❌
```

### Después

```
✅ SUPABASE_ANON_KEY: eyJ...test
✅ S3_ENDPOINT: http://localhost:9000
✅ S3_ACCESS_KEY: minioadmin
✅ S3_SECRET_KEY: minioadmin123
✅ MAIL_HOST: localhost
✅ STRIPE_SECRET_KEY: sk_test_placeholder
✅ STRIPE_WEBHOOK_SECRET: whsec_placeholder
✅ STRIPE_PUBLISHABLE_KEY: pk_test_placeholder

Result: Configuration valid ✅
Tests: 671 tests execute ✅
Seeds: Skipped with warnings ⚠️ (expected)
```

---

## 🔒 Consideraciones de Seguridad

### ✅ Seguro

- Variables son **dummy/fake** - no credenciales reales
- GitHub Actions env es **público en código**
- Se pueden usar cualquier valor ficticio
- No expone secretos del desarrollo

### ❌ NO Seguro (No Hacer)

```yaml
# ❌ NUNCA agregar credenciales reales
STRIPE_SECRET_KEY: sk_live_xxxxxxxxxxxx # ❌ PELIGROSO
S3_ACCESS_KEY: AKIAIOSFODNN7EXAMPLE # ❌ PELIGROSO
SUPABASE_SERVICE_ROLE_KEY: <real_creds> # ❌ PELIGROSO
```

---

## 📚 Archivos Afectados

- `.github/workflows/ci.yml` - Agregar 8 variables
- `.env.test` - SIN CAMBIOS (mantener en .gitignore)
- Código fuente - SIN CAMBIOS

---

## ✅ Checklist Antes de Implementar

- [ ] Verificar que `.env.test` está en `.gitignore`
- [ ] Revisar todas las 8 variables faltantes
- [ ] Confirmar que son valores dummy (no reales)
- [ ] Preparar mensaje de commit
- [ ] Estar listo para monitorear CI/CD después de push

---

## 🎓 Aprendizajes Clave

1. **NestJS ConfigModule** lee de archivos `.env.*` Y sobrescribe con `process.env`
2. **GitHub Actions** puede pasar variables via `env:` en el workflow
3. **`.gitignore`** previene versionear `.env.test` (bueno por seguridad)
4. **Variables dummy** son perfectas para testing en CI/CD
5. **Supabase real** no es necesario para tests aislados

---

**Listo para implementar cuando apruebes el plan.**
