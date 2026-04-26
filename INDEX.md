# Logistics API — Project Index

**Last Updated**: 2026-04-25  
**Status**: Production-ready backend with comprehensive testing suite

---

## Quick Navigation

### 🚀 Getting Started

- **[README.md](./README.md)** — Installation, running, testing
- **[.env.example](.env.example)** — Required environment variables

### 📊 Current Status

- **Unit Tests**: 656 passing (73.21% coverage)
- **E2E Tests**: 13 passing (4 suites active)
- **API Docs**: OpenAPI 3.0 spec generated
- **Code Quality**: Pre-push hooks + linting active

---

## Documentation by Topic

### E2E Testing (Sprint 25 Focus)

| Doc                                                          | Purpose                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| **[docs/E2E-STATUS.md](./docs/E2E-STATUS.md)**               | Current test status, architecture overview, troubleshooting |
| **[docs/E2E-PLAN.md](./docs/E2E-PLAN.md)**                   | Roadmap for remaining 7 suites, implementation patterns     |
| **[docs/E2E-QUICK-REF.md](./docs/E2E-QUICK-REF.md)**         | Quick reference for running tests                           |
| **[docs/SPRINT-25-SUMMARY.md](./docs/SPRINT-25-SUMMARY.md)** | Sprint summary, key learnings, technical details            |
| **[docs/SPRINT-25-AAR.md](./docs/SPRINT-25-AAR.md)**         | After Action Review, metrics, next steps                    |

### API & OpenAPI

| Doc                                                          | Purpose                                 |
| ------------------------------------------------------------ | --------------------------------------- |
| **[scripts/openapi/README.md](./scripts/openapi/README.md)** | OpenAPI generation pipeline             |
| **[docs/postman/README.md](./docs/postman/README.md)**       | Postman collection setup                |
| **[docs/openapi.json](./docs/openapi.json)**                 | Generated OpenAPI spec (178 operations) |
| **[docs/openapi-audit.md](./docs/openapi-audit.md)**         | OpenAPI validation report               |

### Project Management

| Doc                                                                   | Purpose                        |
| --------------------------------------------------------------------- | ------------------------------ |
| **[CHANGELOG.md](./CHANGELOG.md)**                                    | All notable changes by version |
| **[Plan-implementacion-logistics](../Plan-implementacion-logistics)** | Implementation roadmap         |

---

## Running Tests

### Unit Tests

```bash
pnpm test                    # Run all unit tests
pnpm test:cov              # With coverage report
pnpm test:watch            # Watch mode
```

### E2E Tests

```bash
# Start infrastructure
docker-compose -f docker-compose.test.yml up -d

# Run all E2E tests
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand

# Run specific suite
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand test/modules/audit.e2e-spec.ts

# Watch mode
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --watch
```

### Quality Gates

```bash
pnpm env:check             # Validate environment variables
pnpm openapi:check         # Check OpenAPI spec (generate + audit)
pnpm lint                  # Run linter
```

---

## Project Structure

```
logistics-api/
├── src/
│   ├── app.module.ts                    # Root module
│   ├── common/                          # Shared guards, filters, etc
│   ├── config/                          # Configuration (env validation)
│   ├── database/                        # TypeORM setup, migrations
│   ├── modules/
│   │   ├── auth/                        # JWT, Supabase integration
│   │   ├── audit/                       # Audit logging
│   │   ├── plans/                       # Subscription plans
│   │   ├── notifications/               # Push notifications
│   │   ├── admin/                       # Admin endpoints (pending E2E)
│   │   └── ... (other modules)
│   └── main.ts                          # Application entry point
│
├── test/
│   ├── app.e2e-spec.ts                 # Smoke tests (2 tests)
│   ├── modules/
│   │   ├── audit.e2e-spec.ts           # Audit suite (3 tests)
│   │   ├── plans.e2e-spec.ts           # Plans suite (4 tests)
│   │   ├── notifications.e2e-spec.ts   # Notifications (4 tests)
│   │   └── ... (pending suites)
│   ├── helpers/
│   │   └── test-app.helper.ts          # createTestApp(), getAccessToken()
│   ├── setup-e2e-mocks.ts              # Jest mock bootstrap
│   ├── setup-e2e.ts                    # Environment setup
│   └── jest-e2e.config.js              # E2E jest config (deprecated?)
│
├── docs/
│   ├── E2E-STATUS.md                   # E2E architecture + status
│   ├── E2E-PLAN.md                     # Roadmap (7 remaining suites)
│   ├── E2E-QUICK-REF.md                # Quick reference
│   ├── SPRINT-25-SUMMARY.md            # Sprint summary
│   ├── SPRINT-25-AAR.md                # After Action Review
│   ├── openapi.json                    # Generated API spec
│   ├── openapi-audit.md                # Spec validation report
│   └── postman/                        # Postman collection
│
├── scripts/
│   ├── openapi/                        # OpenAPI generation
│   │   ├── generate-openapi.ts
│   │   ├── audit-openapi.ts
│   │   ├── generate-postman.ts
│   │   └── README.md
│   └── check-env-schema.ts             # Env validation script
│
├── .husky/
│   └── pre-push                        # Pre-push hook (test + checks)
│
├── jest.config.e2e.cjs                 # E2E test configuration
├── jest.config.js                      # Unit test configuration
├── tsconfig.json                       # TypeScript config
├── tsconfig.spec.json                  # TypeScript spec config
├── docker-compose.test.yml             # Test infrastructure
├── .env.example                        # Environment template
├── .env.test                           # Test environment
├── CHANGELOG.md                        # Version history
├── README.md                           # Main documentation
└── package.json                        # Dependencies + scripts
```

---

## Key Commands

### Development

```bash
pnpm install               # Install dependencies
pnpm start                # Start in dev mode
pnpm start:dev            # With hot reload
pnpm start:prod           # Production mode
```

### Testing

```bash
pnpm test                 # Unit tests
pnpm test:e2e            # E2E tests (requires Docker)
pnpm test:cov            # Coverage report
```

### Linting & Formatting

```bash
pnpm lint                # Run ESLint
pnpm format              # Format code (Prettier)
```

### Documentation

```bash
pnpm openapi:full        # Generate + audit OpenAPI spec
pnpm openapi:postman     # Generate Postman collection
pnpm env:check           # Validate env variables
```

---

## Technology Stack

### Backend

- **Runtime**: Node.js (v18+)
- **Framework**: NestJS 10
- **ORM**: TypeORM (Postgres)
- **Auth**: Supabase (JWT + JWKS)
- **Cache/Queue**: Redis + BullMQ
- **Validation**: Joi + Class Validator

### Testing

- **Unit**: Jest
- **E2E**: Jest + Supertest
- **Infrastructure**: Docker Compose (Postgres + Redis)

### DevOps

- **Pre-commit**: Husky + Lint-staged
- **API Docs**: NestJS Swagger (OpenAPI 3.0)
- **Postman**: Auto-generated collection

---

## Current Metrics

| Metric            | Value  | Target           |
| ----------------- | ------ | ---------------- |
| Unit Tests        | 656    | ✅ 656           |
| Unit Coverage     | 73.21% | ✅ > 70%         |
| E2E Tests         | 13     | ⏳ 40+ (planned) |
| E2E Suites Active | 4      | ⏳ 11 (planned)  |
| API Operations    | 178    | ✅ Documented    |
| Pre-push Time     | ~25s   | ✅ < 30s         |
| App Bootstrap     | ~2.5s  | ✅ < 5s          |

---

## Next Steps (Sprint 26)

### High Priority

1. Implement **Admin suite** (6-8 tests) — User/org management
2. Implement **Subscriptions suite** (5-7 tests) — Billing flow
3. Add **E2E to CI/CD** (GitHub Actions)

### Medium Priority

4. Implement **Relationships suite** (4-6 tests)
5. Implement **BullMQ suite** (6-8 tests)
6. Coverage reporting (merge unit + E2E)

### Long Term

7. Performance baselines
8. Load testing
9. API contract testing

---

## Support & Troubleshooting

### E2E Tests Won't Run

See **[docs/E2E-STATUS.md#troubleshooting](./docs/E2E-STATUS.md#troubleshooting)**

### Docker Services Not Starting

```bash
# Check status
docker-compose -f docker-compose.test.yml ps

# Restart
docker-compose -f docker-compose.test.yml restart

# View logs
docker-compose -f docker-compose.test.yml logs -f postgres
```

### Environment Variables Invalid

```bash
pnpm env:check          # Validate against schema
cat .env.test           # Check test values
cp .env.example .env    # Reset to template
```

---

## Contributing

1. **Create branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Edit src/ and test/ files
3. **Run tests**: `pnpm test` + `pnpm test:e2e`
4. **Pre-push checks**: Husky hook runs automatically
5. **Commit**: `git commit -m "feat: your feature"`
6. **Push**: `git push origin feature/your-feature`

---

## Project Ownership

- **Author**: Freddy Molleda
- **Repository**: molledafreddy/api-logistics
- **Last Maintained**: 2026-04-25
- **Status**: Active development

---

## License

Internal project (Logistics API backend).

---

**🚀 Ready to contribute? Start with [README.md](./README.md) or pick a suite from [E2E-PLAN.md](./docs/E2E-PLAN.md)**
