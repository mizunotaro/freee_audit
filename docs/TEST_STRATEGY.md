# Test Strategy

## Overview

This document defines the testing strategy for the freee_audit project to ensure quality and reliability.

---

## Test Pyramid

```
        ┌─────────┐
        │   E2E   │  10% - Critical user flows
        │  Tests  │
        ├─────────┤
        │Integration│ 20% - API routes, DB interactions
        │  Tests    │
        ├───────────┤
        │   Unit    │ 70% - Services, Lib, Utils
        │  Tests    │
        └───────────┘
```

---

## Coverage Goals

| Phase | Timeline | Coverage Target |
|-------|----------|-----------------|
| Phase 1 | Week 1-2 | 50% |
| Phase 2 | Week 3-4 | 70% |
| Phase 3 | Week 5-6 | 80% |
| Phase 4 | Week 7-8 | 90%+ |

### Per-Module Targets

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| Services | 35% | 90% | High |
| Lib/Security | 32% | 95% | High |
| Lib/Integrations | 0% | 85% | Medium |
| Lib/Utils | 0% | 90% | Medium |
| Jobs | 0% | 80% | Medium |
| API Routes | 0% | 70% | Medium |

---

## Test Types

### 1. Unit Tests (70%)

**Target:** Services, Lib, Utils, Jobs

**Tools:** Vitest, vitest-mock-extended

**Guidelines:**
- Test all exported functions
- Mock external dependencies
- Test edge cases and error handling
- Aim for 100% branch coverage in critical paths

**Example Structure:**
```
tests/unit/
├── services/
│   ├── audit/
│   │   ├── index.test.ts
│   │   ├── credential-checker.test.ts
│   │   └── receipt-analyzer.test.ts
│   ├── report/
│   │   ├── monthly-report.test.ts
│   │   ├── balance-sheet.test.ts
│   │   └── cash-flow.test.ts
│   └── ...
├── lib/
│   ├── security/
│   │   ├── csrf-protection.test.ts
│   │   ├── rate-limit-middleware.test.ts
│   │   └── input-sanitizer.test.ts
│   └── ...
└── ...
```

### 2. Integration Tests (20%)

**Target:** API Routes, Database interactions

**Tools:** Vitest, MSW (Mock Service Worker)

**Guidelines:**
- Test API endpoints with mock database
- Test database transactions
- Test authentication/authorization
- Test external API integrations with mocks

**Example Structure:**
```
tests/integration/
├── api/
│   ├── auth/
│   │   ├── login.test.ts
│   │   └── me.test.ts
│   ├── audit/
│   │   ├── journals.test.ts
│   │   └── results.test.ts
│   ├── freee/
│   │   ├── journals.test.ts
│   │   └── receipts.test.ts
│   └── ...
└── db/
    └── migrations.test.ts
```

### 3. E2E Tests (10%)

**Target:** Critical user flows

**Tools:** Playwright

**Guidelines:**
- Test key user journeys
- Test cross-browser compatibility
- Test responsive design
- Keep tests stable and maintainable

**Example Structure:**
```
tests/e2e/
├── audit.spec.ts      # Journal audit flow
├── auth.spec.ts       # Authentication flow
├── reports.spec.ts    # Report generation flow
└── settings.spec.ts   # Settings configuration
```

---

## Test Data Strategy

### Factories

Use factory pattern for test data generation:

```typescript
// tests/factories/budget.ts
import { faker } from '@faker-js/faker'

export function createBudget(overrides = {}) {
  return {
    id: faker.string.uuid(),
    fiscalYear: faker.number.int({ min: 2020, max: 2030 }),
    month: faker.number.int({ min: 1, max: 12 }),
    accountCode: faker.string.numeric(4),
    accountName: faker.commerce.productName(),
    amount: faker.number.int({ min: 0, max: 10000000 }),
    departmentId: null,
    ...overrides,
  }
}
```

### Fixtures

Use fixtures for common test scenarios:

```typescript
// tests/fixtures/user.ts
export const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'accountant',
}

export const adminUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  role: 'admin',
}
```

---

## Mocking Strategy

### External APIs

Mock all external API calls:

```typescript
// Use MSW for HTTP mocking
import { setupServer } from 'msw/node'
import { rest } from 'msw'

export const server = setupServer(
  rest.get('https://api.freee.co.jp/*', (req, res, ctx) => {
    return res(ctx.json({ data: 'mocked' }))
  })
)
```

### Database

Use in-memory database for tests:

```typescript
// Use Prisma with test database
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db',
    },
  },
})
```

---

## CI/CD Integration

### Test Execution

Tests run automatically on:
- Pull request creation
- Push to main/master branch
- Scheduled runs (nightly)

### Quality Gates

| Check | Threshold | Action |
|-------|-----------|--------|
| Unit Tests | Must pass | Block merge |
| Integration Tests | Must pass | Block merge |
| E2E Tests | Must pass | Block merge |
| Coverage | >=50% (Phase 1) | Block merge |
| Lint | No errors | Block merge |
| TypeCheck | No errors | Block merge |

### Coverage Reporting

- Coverage reports generated on every CI run
- Reports uploaded to Codecov/SonarCloud
- PR comments show coverage changes
- Trend analysis available in dashboards

---

## Test Execution Commands

### Unit Tests
```bash
pnpm test                    # Run all unit tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # With coverage report
```

### Integration Tests
```bash
pnpm test:integration       # Run integration tests
```

### E2E Tests
```bash
pnpm e2e                    # Run E2E tests
pnpm e2e:ui                 # UI mode
pnpm e2e:debug              # Debug mode
```

### All Tests
```bash
pnpm test:all               # Run all tests
```

---

## Best Practices

### 1. Test Naming
```typescript
// Good
describe('AuditService', () => {
  describe('analyzeJournal', () => {
    it('should return valid result when journal is correct', () => {})
    it('should throw error when journal is invalid', () => {})
  })
})

// Bad
describe('test', () => {
  it('works', () => {})
})
```

### 2. Test Structure (AAA Pattern)
```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ amount: 100 }, { amount: 200 }]
  
  // Act
  const total = calculateTotal(items)
  
  // Assert
  expect(total).toBe(300)
})
```

### 3. Test Independence
- Each test should be independent
- No shared state between tests
- Clean up after each test

### 4. Avoid Test Interdependence
```typescript
// Good
beforeEach(() => {
  // Reset state
})

// Bad
let sharedState
it('test1', () => {
  sharedState = 'value'
})
it('test2', () => {
  // Uses sharedState - BAD
})
```

---

## Maintenance

### Regular Tasks

| Task | Frequency | Owner |
|------|-----------|-------|
| Update test dependencies | Monthly | Dev Team |
| Review test coverage | Weekly | Tech Lead |
| Refactor flaky tests | As needed | Dev Team |
| Update test documentation | As needed | Dev Team |

### Test Health Metrics

- Flaky test rate <1%
- Test execution time <5min (unit), <15min (integration), <30min (E2E)
- Test maintenance time <10% of development time

---

## Troubleshooting

### Common Issues

**1. Flaky E2E Tests**
- Use proper waits (not `sleep`)
- Mock external dependencies
- Use retry mechanisms

**2. Slow Test Execution**
- Parallelize tests
- Use test caching
- Optimize database queries

**3. Low Coverage**
- Identify uncovered code with coverage reports
- Prioritize critical paths
- Add tests for new features

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [MSW Documentation](https://mswjs.io/)

---

## Changelog

### 2026-03-04
- Initial test strategy document created
- Coverage goals defined (50% → 90%)
- Test pyramid structure established
