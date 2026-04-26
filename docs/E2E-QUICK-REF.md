# E2E Quick Reference

## Start Services

```bash
docker-compose -f docker-compose.test.yml up -d
```

## Run Tests

### All E2E Tests

```bash
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand
```

### Single Suite

```bash
# Audit
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand test/modules/audit.e2e-spec.ts

# Plans
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand test/modules/plans.e2e-spec.ts

# Notifications
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand test/modules/notifications.e2e-spec.ts

# Smoke
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand test/app.e2e-spec.ts
```

### Watch Mode

```bash
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --watch
```

## Test Status

✅ **Passing**: 13 tests (4 suites)

- Smoke (2)
- Audit (3)
- Plans (4)
- Notifications (4)

⏳ **Pending**: 7 suites (empty stubs)

- Admin, BullMQ, Relationships, Subscriptions, Verifications, Sanity, Isolation

## Key Files

| File                              | Purpose                           |
| --------------------------------- | --------------------------------- |
| `jest.config.e2e.cjs`             | Jest configuration                |
| `test/setup-e2e-mocks.ts`         | Mock `jwks-rsa` at bootstrap      |
| `test/setup-e2e.ts`               | Env vars (E2E_TEST, NODE_ENV)     |
| `test/helpers/test-app.helper.ts` | createTestApp(), getAccessToken() |
| `.env.test`                       | Test database credentials         |

## Documentation

- **[E2E-STATUS.md](./E2E-STATUS.md)** — Current status, architecture, troubleshooting
- **[E2E-PLAN.md](./E2E-PLAN.md)** — Detailed roadmap for remaining suites
- **[SPRINT-25-SUMMARY.md](./SPRINT-25-SUMMARY.md)** — Sprint summary & learnings

## Infrastructure

```
Postgres 13: localhost:5433 (test database)
Redis 6.2:   localhost:6380 (queue/cache)
```

## Common Issues

### "Cannot find module 'jwks-rsa'"

- Check `jest.config.e2e.cjs` has `setupFiles: ['test/setup-e2e-mocks.ts', ...]`
- Ensure `test/setup-e2e-mocks.ts` has `jest.mock('jwks-rsa', ...)`

### "too many clients"

- Use `--runInBand` flag (already in config)
- Don't run tests in parallel

### Empty test file fails

- Expected behavior for planned suites
- `passWithNoTests: true` in config allows CI to pass

## Quick Debug

```bash
# Check Docker services
docker-compose -f docker-compose.test.yml ps

# Check logs
docker-compose -f docker-compose.test.yml logs -f postgres

# Run single test with verbose output
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --verbose --runInBand test/modules/audit.e2e-spec.ts

# Run with coverage
NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --coverage --runInBand
```

---

**Last Updated**: 2026-04-25  
**Status**: Foundation complete, 13 tests passing ✅
