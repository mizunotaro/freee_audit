import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'journal-1',
          companyId: 'company-1',
          freeeJournalId: 'freee-1',
          entryDate: new Date('2024-01-15'),
          description: 'Test journal entry',
          debitAccount: '普通預金',
          creditAccount: '売上高',
          amount: 10000,
          taxAmount: 1000,
          auditStatus: 'PASSED',
        },
      ]),
    },
    session: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'session-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          companyId: 'company-1',
        },
      }),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'ADMIN',
    companyId: 'company-1',
  }),
}))

describe('Journals API Integration', () => {
  describe('GET /api/journals', () => {
    beforeAll(() => {
      vi.clearAllMocks()
    })

    it('should return journals for authenticated user', async () => {
      const mockRequest = new Request('http://localhost/api/journals?companyId=company-1', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const { GET } = await import('@/app/api/journals/route')
      const response = await GET(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should return 401 for missing token', async () => {
      const mockRequest = new Request('http://localhost/api/journals?companyId=company-1', {
        method: 'GET',
      })

      const { GET } = await import('@/app/api/journals/route')
      const response = await GET(mockRequest as any)

      expect(response.status).toBe(401)
    })

    it('should return 400 for missing companyId', async () => {
      const mockRequest = new Request('http://localhost/api/journals', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const { GET } = await import('@/app/api/journals/route')
      const response = await GET(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('companyId')
    })

    it('should filter by date range', async () => {
      const mockRequest = new Request(
        'http://localhost/api/journals?companyId=company-1&startDate=2024-01-01&endDate=2024-01-31',
        {
          method: 'GET',
          headers: {
            authorization: 'Bearer valid-token',
          },
        }
      )

      const { GET } = await import('@/app/api/journals/route')
      const response = await GET(mockRequest as any)

      expect(response.status).toBe(200)
    })
  })
})
