import { beforeAll, afterAll, vi } from 'vitest'

process.env.DATABASE_URL = 'file:./test.db'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing'
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.CSRF_SECRET = 'test-csrf-secret-for-testing'

vi.mock('@/lib/integrations/ai', () => ({
  AIProvider: vi.fn(),
  createAIProviderFromEnv: vi.fn().mockReturnValue({
    analyzeDocument: vi.fn().mockResolvedValue({
      success: true,
      data: { amount: 10000, date: '2024-01-15' },
    }),
  }),
}))

vi.mock('@/lib/db', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    journal: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditResult: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    exchangeRate: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  }

  return {
    prisma: mockPrisma,
    disconnectDatabase: vi.fn(),
    connectDatabase: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  }
})

beforeAll(() => {
  console.log('Test setup complete')
})

afterAll(() => {
  console.log('Test teardown complete')
})
