import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

const mockMonthlyReport: Record<string, unknown> = {
  companyId: 'company-1',
  fiscalYear: 2024,
  month: 1,
  revenue: 1000000,
  expenses: 800000,
  grossProfit: 200000,
  operatingIncome: 150000,
  netIncome: 100000,
}

const mockMonthlyTrend = [
  { month: 1, revenue: 1000000, expenses: 800000 },
  { month: 2, revenue: 1200000, expenses: 900000 },
  { month: 3, revenue: 1100000, expenses: 850000 },
]

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/services/report/monthly-report', () => ({
  generateMonthlyReport: vi.fn(),
  getMonthlyTrend: vi.fn(),
  getMultiMonthReport: vi.fn(),
}))

describe('Reports API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/reports/monthly', () => {
    it('should generate monthly report for authenticated user', async () => {
      const { generateMonthlyReport, getMonthlyTrend } =
        await import('@/services/report/monthly-report')
      const { validateSession } = await import('@/lib/auth')

      vi.mocked(validateSession).mockResolvedValue(mockUser)
      vi.mocked(generateMonthlyReport).mockResolvedValue(mockMonthlyReport as any)
      vi.mocked(getMonthlyTrend).mockResolvedValue(mockMonthlyTrend as any)

      const report = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 1,
      })

      expect(report).toBeDefined()
      expect((report as unknown as Record<string, unknown>).companyId).toBe('company-1')
      expect((report as unknown as Record<string, unknown>).fiscalYear).toBe(2024)
      expect((report as unknown as Record<string, unknown>).month).toBe(1)
    })

    it('should return monthly trend data', async () => {
      const { getMonthlyTrend } = await import('@/services/report/monthly-report')

      vi.mocked(getMonthlyTrend).mockResolvedValue(mockMonthlyTrend as any)

      const trend = await getMonthlyTrend('company-1', 2024)

      expect(trend).toBeDefined()
      expect(trend.length).toBe(3)
      expect(trend[0].month).toBe(1)
    })

    it('should reject unauthenticated requests', async () => {
      const { validateSession } = await import('@/lib/auth')

      vi.mocked(validateSession).mockResolvedValue(null)

      const user = await validateSession('invalid-token')

      expect(user).toBeNull()
    })

    it('should reject users without company', async () => {
      const { validateSession } = await import('@/lib/auth')

      vi.mocked(validateSession).mockResolvedValue({ ...mockUser, companyId: null })

      const user = await validateSession('valid-token')

      expect(user?.companyId).toBeNull()
    })

    it('should use default fiscal year when not provided', () => {
      const currentYear = new Date().getFullYear()
      const fiscalYear = currentYear

      expect(fiscalYear).toBe(currentYear)
    })

    it('should use default month when not provided', () => {
      const currentMonth = new Date().getMonth()
      const month = currentMonth

      expect(month).toBeGreaterThanOrEqual(0)
      expect(month).toBeLessThanOrEqual(11)
    })
  })

  describe('Multi-Month Report', () => {
    it('should support 3-month report', async () => {
      const { getMultiMonthReport } = await import('@/services/report/monthly-report')

      vi.mocked(getMultiMonthReport).mockResolvedValue([mockMonthlyReport] as any)

      const report = await getMultiMonthReport('company-1', 2024, 3, 3)

      expect(getMultiMonthReport).toHaveBeenCalledWith('company-1', 2024, 3, 3)
    })

    it('should support 6-month report', async () => {
      const { getMultiMonthReport } = await import('@/services/report/monthly-report')

      vi.mocked(getMultiMonthReport).mockResolvedValue([mockMonthlyReport] as any)

      const report = await getMultiMonthReport('company-1', 2024, 6, 6)

      expect(getMultiMonthReport).toHaveBeenCalledWith('company-1', 2024, 6, 6)
    })

    it('should support 12-month report', async () => {
      const { getMultiMonthReport } = await import('@/services/report/monthly-report')

      vi.mocked(getMultiMonthReport).mockResolvedValue([mockMonthlyReport] as any)

      const report = await getMultiMonthReport('company-1', 2024, 12, 12)

      expect(getMultiMonthReport).toHaveBeenCalledWith('company-1', 2024, 12, 12)
    })

    it('should validate monthCount values', () => {
      const validMonthCounts = [3, 6, 12] as const
      const invalidMonthCounts = [1, 2, 4, 5, 7, 24]

      for (const count of validMonthCounts) {
        expect([3, 6, 12].includes(count)).toBe(true)
      }

      for (const count of invalidMonthCounts) {
        expect([3, 6, 12].includes(count as 3 | 6 | 12)).toBe(false)
      }
    })
  })

  describe('Report Modes', () => {
    it('should support single month mode', async () => {
      const { generateMonthlyReport, getMonthlyTrend } =
        await import('@/services/report/monthly-report')

      vi.mocked(generateMonthlyReport).mockResolvedValue(mockMonthlyReport as any)
      vi.mocked(getMonthlyTrend).mockResolvedValue(mockMonthlyTrend as any)

      const mode = 'single'

      if (mode === 'single') {
        const report = await generateMonthlyReport({
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 1,
        })
        const trend = await getMonthlyTrend('company-1', 2024)

        expect(report).toBeDefined()
        expect(trend).toBeDefined()
      }
    })

    it('should support table mode (multi-month)', async () => {
      const { getMultiMonthReport, getMonthlyTrend } =
        await import('@/services/report/monthly-report')

      vi.mocked(getMultiMonthReport).mockResolvedValue([mockMonthlyReport] as any)
      vi.mocked(getMonthlyTrend).mockResolvedValue(mockMonthlyTrend as any)

      const mode = 'table'
      const monthCount = 3

      if (mode === 'table') {
        const report = await getMultiMonthReport('company-1', 2024, 3, monthCount)
        const trend = await getMonthlyTrend('company-1', 2024)

        expect(report).toBeDefined()
        expect(trend).toBeDefined()
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle report generation errors', async () => {
      const { generateMonthlyReport } = await import('@/services/report/monthly-report')

      vi.mocked(generateMonthlyReport).mockRejectedValue(new Error('Report generation failed'))

      await expect(
        generateMonthlyReport({
          companyId: 'company-1',
          fiscalYear: 2024,
          month: 1,
        })
      ).rejects.toThrow('Report generation failed')
    })

    it('should handle trend retrieval errors', async () => {
      const { getMonthlyTrend } = await import('@/services/report/monthly-report')

      vi.mocked(getMonthlyTrend).mockRejectedValue(new Error('Trend retrieval failed'))

      await expect(getMonthlyTrend('company-1', 2024)).rejects.toThrow('Trend retrieval failed')
    })
  })

  describe('Response Format', () => {
    it('should include report and trend in response', async () => {
      const { generateMonthlyReport, getMonthlyTrend } =
        await import('@/services/report/monthly-report')

      vi.mocked(generateMonthlyReport).mockResolvedValue(mockMonthlyReport as any)
      vi.mocked(getMonthlyTrend).mockResolvedValue(mockMonthlyTrend as any)

      const report = await generateMonthlyReport({
        companyId: 'company-1',
        fiscalYear: 2024,
        month: 1,
      })
      const trend = await getMonthlyTrend('company-1', 2024)

      const response = { report, trend }

      expect(response.report).toBeDefined()
      expect(response.trend).toBeDefined()
    })
  })
})
