import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import {
  getBoardReports,
  getBoardReport,
  generateBoardReport,
  updateBoardReport,
  updateBoardReportSection,
  deleteBoardReport,
  type GenerateReportOptions,
} from '@/services/reports/board-report-service'
import type { ProfitLoss, BalanceSheet, CashFlowStatement } from '@/types'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        boardReport: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        boardReportSection: {
          update: vi.fn(),
        },
        debt: {
          findMany: vi.fn(),
        },
        budget: {
          findFirst: vi.fn(),
        },
        budgetItem: {
          findMany: vi.fn(),
        },
      }
      return fn(tx)
    }),
    boardReport: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    boardReportSection: {
      update: vi.fn(),
    },
    debt: {
      findMany: vi.fn(),
    },
    budget: {
      findFirst: vi.fn(),
    },
    budgetItem: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/services/budget/detailed-actual-vs-budget', () => ({
  calculateDetailedActualVsBudget: vi.fn().mockResolvedValue({
    stageLevel: [
      {
        stage: '売上高',
        budget: 10000000,
        actual: 9500000,
        variance: -500000,
        rate: 95,
        status: 'warning',
      },
    ],
    accountLevel: [
      {
        code: '100',
        name: '売上高',
        category: 'revenue',
        budget: 10000000,
        actual: 9500000,
        variance: -500000,
        rate: 95,
        status: 'warning',
      },
    ],
    summary: {
      totalBudget: 10000000,
      totalActual: 9500000,
      totalVariance: -500000,
    },
  }),
}))

vi.mock('@/services/cashflow/runway-calculator', () => ({
  calculateRunway: vi.fn().mockReturnValue({
    monthlyBurnRate: 2000000,
    runwayMonths: 12,
    currentCash: 24000000,
    scenarios: {
      optimistic: { burnRate: 1500000, runwayMonths: 16 },
      realistic: { burnRate: 2000000, runwayMonths: 12 },
      pessimistic: { burnRate: 2500000, runwayMonths: 9 },
    },
  }),
  getRunwayAlert: vi.fn().mockReturnValue({
    level: 'safe',
    message: 'Runway is healthy',
  }),
}))

describe('BoardReportService', () => {
  const mockCompanyId = 'test-company-id'
  const mockFiscalYear = 2024
  const mockMonth = 6

  const mockFinancialData = {
    pl: {
      revenue: [{ amount: 9500000 }],
      grossProfit: 4000000,
      operatingIncome: 1500000,
    } as unknown as ProfitLoss,
    bs: {
      totalAssets: 50000000,
      totalLiabilities: 20000000,
      equity: 30000000,
    } as unknown as BalanceSheet,
    cf: [
      {
        fiscalYear: 2024,
        month: 5,
        endingCash: 22000000,
        operatingActivities: { netCashProvided: 2000000 },
        investingActivities: { purchaseOfFixedAssets: -500000 },
        financingActivities: { repaymentOfBorrowing: -300000 },
      },
      {
        fiscalYear: 2024,
        month: 6,
        endingCash: 24000000,
        operatingActivities: { netCashProvided: 2500000 },
        investingActivities: { purchaseOfFixedAssets: -300000 },
        financingActivities: { repaymentOfBorrowing: -200000 },
      },
    ] as unknown as CashFlowStatement[],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBoardReports', () => {
    it('should retrieve all board reports for a company', async () => {
      const mockReports = [
        {
          id: 'report-1',
          companyId: mockCompanyId,
          fiscalYear: 2024,
          month: 6,
          title: '2024年度 6月 取締役会報告資料',
          summary: null,
          status: 'DRAFT',
          generatedAt: new Date(),
          presentedAt: null,
          approvedBy: null,
          approvedAt: null,
          sections: [],
        },
        {
          id: 'report-2',
          companyId: mockCompanyId,
          fiscalYear: 2024,
          month: 5,
          title: '2024年度 5月 取締役会報告資料',
          summary: 'Monthly summary',
          status: 'APPROVED',
          generatedAt: new Date(),
          presentedAt: new Date(),
          approvedBy: 'user-1',
          approvedAt: new Date(),
          sections: [],
        },
      ]

      vi.mocked(prisma.boardReport.findMany).mockResolvedValue(mockReports as any)

      const result = await getBoardReports(mockCompanyId)

      expect(result).toHaveLength(2)
      expect(result[0].title).toContain('6月')
      expect(result[1].title).toContain('5月')
    })

    it('should return empty array when no reports exist', async () => {
      vi.mocked(prisma.boardReport.findMany).mockResolvedValue([])

      const result = await getBoardReports(mockCompanyId)

      expect(result).toEqual([])
    })
  })

  describe('getBoardReport', () => {
    it('should retrieve single board report by ID', async () => {
      const mockReport = {
        id: 'report-1',
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 6,
        title: '2024年度 6月 取締役会報告資料',
        summary: 'Test summary',
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [
          {
            sectionType: 'FINANCIAL_SUMMARY',
            title: '月次決算サマリー',
            content: 'Content here',
            data: null,
            sortOrder: 0,
          },
        ],
      }

      vi.mocked(prisma.boardReport.findUnique).mockResolvedValue(mockReport as any)

      const result = await getBoardReport('report-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('report-1')
      expect(result?.sections).toHaveLength(1)
    })

    it('should return null when report not found', async () => {
      vi.mocked(prisma.boardReport.findUnique).mockResolvedValue(null)

      const result = await getBoardReport('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('generateBoardReport', () => {
    it('should generate report with all sections', async () => {
      const mockCreatedReport = {
        id: 'new-report',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        month: mockMonth,
        title: `${mockFiscalYear}年度 ${mockMonth}月 取締役会報告資料`,
        summary: null,
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [
          {
            sectionType: 'FINANCIAL_SUMMARY',
            title: '月次決算サマリー',
            content: 'Test content',
            data: null,
            sortOrder: 0,
          },
        ],
      }

      vi.mocked(prisma.debt.findMany).mockResolvedValue([])
      vi.mocked(prisma.boardReport.create).mockResolvedValue(mockCreatedReport as any)

      const options: GenerateReportOptions = {
        includeLlmAnalysis: false,
        language: 'ja',
        detailLevel: 'detailed',
      }

      const result = await generateBoardReport(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockFinancialData,
        options
      )

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('title')
      expect(result.title).toContain(`${mockFiscalYear}年度`)
      expect(result.title).toContain(`${mockMonth}月`)
      expect(result.status).toBe('DRAFT')
      expect(prisma.boardReport.create).toHaveBeenCalled()
    })

    it('should include LLM analysis when requested', async () => {
      const mockCreatedReport = {
        id: 'new-report',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        month: mockMonth,
        title: `${mockFiscalYear}年度 ${mockMonth}月 取締役会報告資料`,
        summary: null,
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      vi.mocked(prisma.debt.findMany).mockResolvedValue([])
      vi.mocked(prisma.boardReport.create).mockResolvedValue(mockCreatedReport as any)

      const options: GenerateReportOptions = {
        includeLlmAnalysis: true,
        language: 'ja',
        detailLevel: 'detailed',
      }

      await generateBoardReport(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockFinancialData,
        options
      )

      const createCall = vi.mocked(prisma.boardReport.create).mock.calls[0][0]
      const sections = (createCall.data.sections as any)?.create
      const hasLlmSection = sections?.some((s: any) => s.sectionType === 'LLM_ANALYSIS')
      expect(hasLlmSection).toBe(true)
    })

    it('should generate report with financial summary section', async () => {
      const mockCreatedReport = {
        id: 'new-report',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        month: mockMonth,
        title: `${mockFiscalYear}年度 ${mockMonth}月 取締役会報告資料`,
        summary: null,
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      vi.mocked(prisma.debt.findMany).mockResolvedValue([])
      vi.mocked(prisma.boardReport.create).mockResolvedValue(mockCreatedReport as any)

      const options: GenerateReportOptions = {
        includeLlmAnalysis: false,
        language: 'ja',
        detailLevel: 'detailed',
      }

      await generateBoardReport(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockFinancialData,
        options
      )

      const createCall = vi.mocked(prisma.boardReport.create).mock.calls[0][0]
      const sections = (createCall.data.sections as any)?.create as Array<any>

      expect(sections.some((s) => s.sectionType === 'FINANCIAL_SUMMARY')).toBe(true)
      expect(sections.some((s) => s.sectionType === 'BUDGET_VARIANCE')).toBe(true)
      expect(sections.some((s) => s.sectionType === 'CASH_POSITION')).toBe(true)
      expect(sections.some((s) => s.sectionType === 'KEY_METRICS')).toBe(true)
    })
  })

  describe('updateBoardReport', () => {
    it('should update report title', async () => {
      const mockUpdatedReport = {
        id: 'report-1',
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 6,
        title: 'Updated Title',
        summary: null,
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      vi.mocked(prisma.boardReport.update).mockResolvedValue(mockUpdatedReport as any)

      const result = await updateBoardReport('report-1', {
        title: 'Updated Title',
      })

      expect(result.title).toBe('Updated Title')
    })

    it('should update report status', async () => {
      const mockUpdatedReport = {
        id: 'report-1',
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 6,
        title: 'Test Report',
        summary: null,
        status: 'APPROVED',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      vi.mocked(prisma.boardReport.update).mockResolvedValue(mockUpdatedReport as any)

      const result = await updateBoardReport('report-1', {
        status: 'APPROVED',
      })

      expect(result.status).toBe('APPROVED')
    })

    it('should set approval timestamp when approvedBy is set', async () => {
      const mockUpdatedReport = {
        id: 'report-1',
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 6,
        title: 'Test Report',
        summary: null,
        status: 'APPROVED',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: 'user-1',
        approvedAt: new Date(),
        sections: [],
      }

      vi.mocked(prisma.boardReport.update).mockResolvedValue(mockUpdatedReport as any)

      await updateBoardReport('report-1', {
        approvedBy: 'user-1',
      })

      const updateCall = vi.mocked(prisma.boardReport.update).mock.calls[0][0]
      expect(updateCall.data).toHaveProperty('approvedAt')
    })

    it('should update presentedAt timestamp', async () => {
      const presentedDate = new Date('2024-06-30')
      const mockUpdatedReport = {
        id: 'report-1',
        companyId: mockCompanyId,
        fiscalYear: 2024,
        month: 6,
        title: 'Test Report',
        summary: null,
        status: 'PRESENTED',
        generatedAt: new Date(),
        presentedAt: presentedDate,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      vi.mocked(prisma.boardReport.update).mockResolvedValue(mockUpdatedReport as any)

      await updateBoardReport('report-1', {
        presentedAt: presentedDate,
      })

      const updateCall = vi.mocked(prisma.boardReport.update).mock.calls[0][0]
      expect(updateCall.data.presentedAt).toEqual(presentedDate)
    })
  })

  describe('updateBoardReportSection', () => {
    it('should update section content', async () => {
      vi.mocked(prisma.boardReportSection.update).mockResolvedValue({} as any)

      await updateBoardReportSection('section-1', {
        title: 'Updated Section Title',
        content: 'Updated content',
      })

      expect(prisma.boardReportSection.update).toHaveBeenCalledWith({
        where: { id: 'section-1' },
        data: {
          title: 'Updated Section Title',
          content: 'Updated content',
        },
      })
    })
  })

  describe('deleteBoardReport', () => {
    it('should delete board report', async () => {
      vi.mocked(prisma.boardReport.delete).mockResolvedValue({} as any)

      await deleteBoardReport('report-1')

      expect(prisma.boardReport.delete).toHaveBeenCalledWith({
        where: { id: 'report-1' },
      })
    })
  })

  describe('Report Generation Edge Cases', () => {
    it('should handle empty cash flow data', async () => {
      const mockCreatedReport = {
        id: 'new-report',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        month: mockMonth,
        title: `${mockFiscalYear}年度 ${mockMonth}月 取締役会報告資料`,
        summary: null,
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      vi.mocked(prisma.debt.findMany).mockResolvedValue([])
      vi.mocked(prisma.boardReport.create).mockResolvedValue(mockCreatedReport as any)

      const emptyFinancialData = {
        ...mockFinancialData,
        cf: [],
      }

      const options: GenerateReportOptions = {
        includeLlmAnalysis: false,
        language: 'ja',
        detailLevel: 'detailed',
      }

      const result = await generateBoardReport(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        emptyFinancialData,
        options
      )

      expect(result).toBeDefined()
      expect(result.id).toBe('new-report')
    })

    it('should handle upcoming payments', async () => {
      const mockCreatedReport = {
        id: 'new-report',
        companyId: mockCompanyId,
        fiscalYear: mockFiscalYear,
        month: mockMonth,
        title: `${mockFiscalYear}年度 ${mockMonth}月 取締役会報告資料`,
        summary: null,
        status: 'DRAFT',
        generatedAt: new Date(),
        presentedAt: null,
        approvedBy: null,
        approvedAt: null,
        sections: [],
      }

      const mockDebts = [
        {
          id: 'debt-1',
          description: 'Office Rent',
          amount: 500000,
          dueDate: new Date('2024-07-01'),
          category: 'rent',
          status: 'PENDING',
        },
        {
          id: 'debt-2',
          description: 'Equipment Lease',
          amount: 200000,
          dueDate: new Date('2024-07-15'),
          category: 'lease',
          status: 'PENDING',
        },
      ]

      vi.mocked(prisma.debt.findMany).mockResolvedValue(mockDebts as any)
      vi.mocked(prisma.boardReport.create).mockResolvedValue(mockCreatedReport as any)

      const options: GenerateReportOptions = {
        includeLlmAnalysis: false,
        language: 'ja',
        detailLevel: 'detailed',
      }

      await generateBoardReport(
        mockCompanyId,
        mockFiscalYear,
        mockMonth,
        mockFinancialData,
        options
      )

      expect(prisma.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
            status: 'PENDING',
          }),
        })
      )
    })
  })
})
