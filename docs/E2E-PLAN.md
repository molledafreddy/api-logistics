# E2E Test Implementation Plan

**Status**: Phase 6 (7 suites pending)  
**Baseline**: 4 suites ✅ 13 tests passing

---

## Suite Roadmap

### Priority 1: Critical User Flows (Next Sprint)

#### 1.1 Admin Suite (`test/modules/admin.e2e-spec.ts`)

**Purpose**: User/organization management endpoints  
**Estimated Tests**: 6-8
**Dependencies**: None (admin endpoints available in API)

**Test Cases**:

- `GET /api/v1/admin/users` — list all users (admin only)
- `GET /api/v1/admin/users/:id` — fetch user details
- `PATCH /api/v1/admin/users/:id/role` — update user role
- `DELETE /api/v1/admin/users/:id` — soft-delete user
- `GET /api/v1/admin/organizations` — list orgs
- `POST /api/v1/admin/organizations` — create org
- `PATCH /api/v1/admin/organizations/:id` — update org
- Permission checks: non-admin users get 403

**Setup**:

- Create test user with `admin` role via Supabase Auth
- Override `getAccessToken()` to use admin JWT
- Pre-seed test data (users, orgs) in beforeAll

---

#### 1.2 Subscriptions Suite (`test/modules/subscriptions.e2e-spec.ts`)

**Purpose**: Billing + stripe integration  
**Estimated Tests**: 5-7
**Dependencies**: Admin suite (org creation)

**Test Cases**:

- `GET /api/v1/subscriptions/plans` — list available plans (public)
- `POST /api/v1/subscriptions/checkout` — create stripe checkout session
- `GET /api/v1/subscriptions/status` — fetch org subscription status
- `POST /api/v1/subscriptions/webhook` — handle stripe webhook (signature validation)
- `PATCH /api/v1/subscriptions/cancel` — cancel subscription
- Feature gating: verify features disabled for free plan

**Setup**:

- Mock Stripe API (or use test keys)
- Pre-create subscription in test DB
- Webhook signature validation test

---

#### 1.3 Relationships Suite (`test/modules/relationships.e2e-spec.ts`)

**Purpose**: Entity linking (users ↔ orgs, items ↔ plans, etc.)  
**Estimated Tests**: 4-6
**Dependencies**: None (isolated data model)

**Test Cases**:

- `GET /api/v1/users/:id/organizations` — list user's orgs
- `POST /api/v1/organizations/:id/members` — add user to org
- `DELETE /api/v1/organizations/:id/members/:userId` — remove member
- `GET /api/v1/plans/:id/items` — list plan items
- `PATCH /api/v1/plans/:id/items/:itemId` — reorder/update item
- Permission checks: user can't modify other user's relationships

**Setup**:

- Pre-create users, orgs, plans
- Link them in beforeEach
- Test cascade deletes

---

### Priority 2: Background & Integration (Sprint +1)

#### 2.1 BullMQ Suite (`test/modules/bullmq.e2e-spec.ts`)

**Purpose**: Background job processing (audit logs, notifications, etc.)  
**Estimated Tests**: 6-8
**Dependencies**: Redis working (already via docker-compose)

**Test Cases**:

- Job queue creation + processing
- `AuditLogJob` → creates audit entry after action
- `NotificationJob` → sends push notification
- Retry logic on failure
- Dead-letter queue handling
- Job event hooks (onProgress, onCompleted, onFailed)

**Setup**:

- Start Redis in docker-compose ✅ (already running)
- Inject BullModule in test app
- Mock push notification provider (Firebase/OneSignal)
- Verify job state in database after async completion

---

#### 2.2 Verifications Suite (`test/modules/verifications.e2e-spec.ts`)

**Purpose**: Email/SMS verification, 2FA  
**Estimated Tests**: 5-7
**Dependencies**: Email provider (SendGrid/Postmark), SMS provider (Twilio)

**Test Cases**:

- `POST /api/v1/verifications/send-email` — trigger verification email
- `POST /api/v1/verifications/verify-code` — validate OTP
- `POST /api/v1/verifications/2fa/enable` — setup 2FA
- `POST /api/v1/verifications/2fa/validate` — validate 2FA code
- Expiry handling (code valid 10min)
- Rate limiting (3 attempts max)

**Setup**:

- Mock email/SMS providers (don't send real messages)
- Store verification codes in Redis
- Generate valid OTP via totp library

---

### Priority 3: Cross-Module & Validation (Sprint +2)

#### 3.1 Sanity Suite (`test/sanity.e2e-spec.ts`)

**Purpose**: Cross-module integration + data consistency  
**Estimated Tests**: 8-10
**Dependencies**: All modules (smoke test for the whole system)

**Test Cases**:

- Create plan → Audit log created ✅
- Delete plan → Soft-deleted in DB, audit log created
- User signup → Welcome notification queued in BullMQ
- Subscription change → Audit + notification + feature update
- Concurrent requests → No race conditions
- Database constraints → Foreign key integrity

**Setup**:

- Full end-to-end flow tests
- Verify state in multiple tables
- Check audit logs for all actions
- Validate async jobs complete

---

#### 3.2 Isolation Suite (`test/_iso.e2e-spec.ts`)

**Purpose**: Test database isolation between test runs  
**Estimated Tests**: 4-5
**Dependencies**: Database cleanup hooks

**Test Cases**:

- Test A modifies record → Test B doesn't see changes
- Concurrent tests don't conflict
- Transactions rollback on test failure
- Table sequences reset between runs

**Setup**:

- Database snapshot + rollback between tests
- Or: dedicated test isolation patterns
- Verify beforeEach cleanup runs correctly

---

## Implementation Pattern

Each E2E suite follows this template:

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getAccessToken,
  getAdminAccessToken, // if needed
  seedTestData, // if needed
} from '../helpers/test-app.helper';

describe('[Module Name] E2E', () => {
  let app: INestApplication;
  let jwt: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = await getAccessToken(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /api/v1/[endpoint]', () => {
    it('should return 200 with valid JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/[endpoint]')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 401 without JWT', async () => {
      await request(app.getHttpServer()).get('/api/v1/[endpoint]').expect(401);
    });
  });

  describe('POST /api/v1/[endpoint]', () => {
    it('should create resource with valid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/[endpoint]')
        .set('Authorization', `Bearer ${jwt}`)
        .send({
          /* payload */
        })
        .expect(201);
      expect(res.body.id).toBeDefined();
    });

    it('should return 400 with invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/[endpoint]')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ invalid: 'data' })
        .expect(400);
    });
  });
});
```

---

## Test Data Strategy

### Fixtures (Pre-created Data)

Create `test/fixtures/` directory with seed functions:

```typescript
// test/fixtures/users.fixture.ts
export async function seedTestUser(app: INestApplication) {
  return await createTestApp().getService(UserService).create({
    email: 'test@example.com',
    role: 'user',
  });
}

// Usage in test
const user = await seedTestUser(app);
```

### Database Cleanup

```typescript
// test/helpers/test-app.helper.ts
afterAll(async () => {
  // Option A: Truncate all tables
  await queryRunner.clearDatabase();

  // Option B: Rollback transaction
  await queryRunner.rollbackTransaction();

  // Close connections
  await app.close();
});
```

---

## CI/CD Integration

### GitHub Actions E2E Step

```yaml
- name: Start test infrastructure
  run: docker-compose -f docker-compose.test.yml up -d

- name: Wait for services
  run: |
    docker-compose -f docker-compose.test.yml exec -T postgres pg_isready
    docker-compose -f docker-compose.test.yml exec -T redis redis-cli ping

- name: Run E2E tests
  run: NODE_ENV=test pnpm exec jest --config jest.config.e2e.cjs --runInBand
  timeout-minutes: 15

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/e2e-coverage.json
```

---

## Performance Targets

| Metric          | Target | Current          |
| --------------- | ------ | ---------------- |
| Total E2E suite | < 30s  | ~4.2s (13 tests) |
| Per test avg    | < 1s   | ~320ms           |
| App bootstrap   | < 3s   | ~2.5s            |
| DB migration    | < 2s   | ~1.5s            |
| Test isolation  | 100%   | ✅ (serial exec) |

---

## Known Challenges

### 1. Stripe Testing

- **Challenge**: Real Stripe API in E2E
- **Solution**: Use Stripe test keys + webhook simulator
- **Or**: Mock Stripe client entirely

### 2. Email/SMS Providers

- **Challenge**: SendGrid/Twilio require real API keys
- **Solution**: Mock provider, store sent messages in memory
- **Verify**: Check mock.sendEmail() was called with correct params

### 3. External APIs

- **Challenge**: Firebase, OneSignal, etc.
- **Solution**: Mock all external services in setupFiles
- **Pattern**: Inject mock provider in test TestingModule

### 4. Data Volume

- **Challenge**: E2E tests may accumulate data over time
- **Solution**: Truncate test database after each suite
- **Or**: Use test-specific schema/database name

---

## Success Criteria

- [x] 4 suites active, 13 tests passing
- [ ] 7 suites implemented (35-40 tests)
- [ ] All E2E tests < 30s total
- [ ] 100% test isolation (no cross-test pollution)
- [ ] 0 flaky tests (no timing issues)
- [ ] E2E in CI/CD (GitHub Actions)
- [ ] Coverage reports (unit + E2E merged)

---

**Next Sprint Actions**:

1. Implement Admin suite (highest impact)
2. Implement Subscriptions suite
3. Add E2E to GitHub Actions
4. Document test data strategy
5. Performance profiling

---

**Owner**: GitHub Copilot  
**Last Updated**: 2026-04-25  
**Status**: Ready to assign 🚀
