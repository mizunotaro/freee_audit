import { vi } from 'vitest'
import type { User } from '@prisma/client'

export interface TestUser {
  id: string
  email: string
  name: string
  role: string
  companyId: string | null
  passwordHash?: string
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'VIEWER',
    companyId: 'company-1',
    ...overrides,
  }
}

export function createTestAdminUser(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'ADMIN', ...overrides })
}

export function createTestSuperAdminUser(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'SUPER_ADMIN', companyId: null, ...overrides })
}

export function createTestViewerUser(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'VIEWER', ...overrides })
}

export function createTestAccountantUser(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({ role: 'ACCOUNTANT', ...overrides })
}

export function createMockPrismaUser(user: TestUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    passwordHash: user.passwordHash || '$2a$12$test.hash.value',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function createMockSession(user: TestUser, token: string = 'valid-token') {
  return {
    id: `session-${Date.now()}`,
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  }
}
