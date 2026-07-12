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
