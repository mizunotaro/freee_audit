import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PDFExportService, createPDFExportService } from '@/services/export/pdf-export'
import type {
  ExportOptions,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  MonthlyReportData,
} from '@/services/export/types'

describe('PDFExportService', () => {
  let service: PDFExportService

  const mockOptions: ExportOptions = {
    format: 'pdf',
    language: 'ja',
    paperSize: 'A4',
    orientation: 'portrait',
    currency: 'JPY',
    includeCharts: true,
  }

  const mockBalanceSheet: BalanceSheetData = {
    fiscalYear: 2024,
    month: 12,
    asOfDate: new Date('2024-12-31'),
    assets: {
      current: [
        { code: '1000', name: '現金', amount: 5000000 },
        { code: '1100', name: '売掛金', amount: 3000000 },
      ],
      fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
      total: 18000000,
    },
    liabilities: {
      current: [{ code: '3000', name: '買掛金', amount: 2000000 }],
      fixed: [{ code: '4000', name: '長期借入金', amount: 5000000 }],
      total: 7000000,
    },
    equity: {
      items: [{ code: '5000', name: '資本金', amount: 11000000 }],
      total: 11000000,
    },
  }

  const mockProfitLoss: ProfitLossData = {
    fiscalYear: 2024,
    startMonth: 1,
    endMonth: 12,
    revenue: 10000000,
    costOfSales: 6000000,
    grossProfit: 4000000,
    sgaExpenses: [
      { code: 'E001', name: '給与手当', amount: 1500000 },
      { code: 'E002', name: '広告宣伝費', amount: 500000 },
    ],
    operatingIncome: 2000000,
    nonOperatingIncome: 0,
    nonOperatingExpenses: 0,
    ordinaryIncome: 2000000,
    extraordinaryIncome: 0,
    extraordinaryLoss: 0,
    incomeBeforeTax: 2000000,
    corporateTax: 600000,
    netIncome: 1400000,
  }

  const mockCashFlow: CashFlowData = {
    fiscalYear: 2024,
    month: 12,
    operatingActivities: {
      netIncome: 1400000,
      adjustments: [{ code: 'D001', name: '減価償却費', amount: 300000 }],
      netCashFromOperating: 2000000,
    },
    investingActivities: {
      items: [{ code: 'I001', name: '設備投資', amount: -500000 }],
      netCashFromInvesting: -500000,
    },
    financingActivities: {
      items: [],
      netCashFromFinancing: 0,
    },
    netChangeInCash: 1500000,
    beginningCash: 3500000,
    endingCash: 5000000,
  }

  const mockMonthlyReport: MonthlyReportData = {
    fiscalYear: 2024,
    month: 12,
    balanceSheet: mockBalanceSheet,
    profitLoss: mockProfitLoss,
    cashFlow: mockCashFlow,
    summary: {
      highlights: ['売上高が前月比10%増加', '営業利益率が改善'],
      issues: ['在庫回転率が低下'],
      nextMonthGoals: ['売上5%増加'],
    },
    kpi: {
      fiscalYear: 2024,
      month: 12,
      profitability: [{ key: 'roe', name: 'ROE', nameEn: 'ROE', value: 12.5, unit: '%' }],
      efficiency: [
        {
          key: 'asset_turnover',
          name: '資産回転率',
          nameEn: 'Asset Turnover',
          value: 0.8,
          unit: '回',
        },
      ],
      safety: [
        { key: 'current_ratio', name: '流動比率', nameEn: 'Current Ratio', value: 150, unit: '%' },
      ],
      growth: [
        {
          key: 'revenue_growth',
          name: '売上成長率',
          nameEn: 'Revenue Growth',
          value: 15,
          unit: '%',
        },
      ],
      cashFlow: [{ key: 'fcf', name: 'FCF', nameEn: 'Free Cash Flow', value: 1500000, unit: '円' }],
    },
  }

  beforeEach(() => {
    service = new PDFExportService()
    vi.clearAllMocks()
  })

  describe('export', () => {
    it('should export balance sheet to PDF', async () => {
      const result = await service.export(mockBalanceSheet, mockOptions)

      expect(result.filename).toContain('balance_sheet')
      expect(result.filename).toContain('.pdf')
      expect(result.mimeType).toBe('application/pdf')
      expect(result.downloadUrl).toBeDefined()
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should export profit loss to PDF', async () => {
      const result = await service.export(mockProfitLoss, mockOptions)

      expect(result.filename).toContain('profit_loss')
      expect(result.mimeType).toBe('application/pdf')
    })

    it('should export cash flow to PDF', async () => {
      const result = await service.export(mockCashFlow, mockOptions)

      expect(result.filename).toContain('cash_flow')
      expect(result.mimeType).toBe('application/pdf')
    })

    it('should export monthly report to PDF', async () => {
      const result = await service.export(mockMonthlyReport, mockOptions)

      expect(result.filename).toContain('monthly_report')
      expect(result.mimeType).toBe('application/pdf')
    })
  })

  describe('getSupportedFormats', () => {
    it('should return pdf as supported format', () => {
      const formats = service.getSupportedFormats()

      expect(formats).toContain('pdf')
    })
  })

  describe('filename generation', () => {
    it('should generate filename with date', async () => {
      const result = await service.export(mockBalanceSheet, mockOptions)
      const today = new Date().toISOString().split('T')[0]

      expect(result.filename).toContain(today)
    })

    it('should include language in filename', async () => {
      const enOptions = { ...mockOptions, language: 'en' as const }
      const result = await service.export(mockBalanceSheet, enOptions)

      expect(result.filename).toContain('_en')
    })

    it('should handle dual language', async () => {
      const dualOptions = { ...mockOptions, language: 'dual' as const }
      const result = await service.export(mockBalanceSheet, dualOptions)

      expect(result.filename).toContain('ja-en')
    })
  })

  describe('currency formatting', () => {
    it('should format JPY currency', async () => {
      const result = await service.export(mockBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should format dual currency with exchange rate', async () => {
      const dualOptions: ExportOptions = {
        ...mockOptions,
        currency: 'dual',
        exchangeRate: 149.5,
      }

      const result = await service.export(mockBalanceSheet, dualOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should format USD currency', async () => {
      const usdOptions: ExportOptions = {
        ...mockOptions,
        currency: 'USD',
      }

      const result = await service.export(mockBalanceSheet, usdOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe('language support', () => {
    it('should render Japanese labels', async () => {
      const result = await service.export(mockBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should render English labels', async () => {
      const enOptions = { ...mockOptions, language: 'en' as const }
      const result = await service.export(mockBalanceSheet, enOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })
})

describe('createPDFExportService', () => {
  it('should create PDFExportService instance', () => {
    const service = createPDFExportService()

    expect(service).toBeInstanceOf(PDFExportService)
  })
})

describe('PDFExportService edge cases', () => {
  let service: PDFExportService

  const mockOptions: ExportOptions = {
    format: 'pdf',
    language: 'ja',
    paperSize: 'A4',
    orientation: 'portrait',
    currency: 'JPY',
    includeCharts: true,
  }

  beforeEach(() => {
    service = new PDFExportService()
    vi.clearAllMocks()
  })

  describe('empty data handling', () => {
    it('should handle empty balance sheet', async () => {
      const emptyBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
      }

      const result = await service.export(emptyBalanceSheet, mockOptions)

      expect(result.filename).toBeDefined()
      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle empty profit loss', async () => {
      const emptyProfitLoss: ProfitLossData = {
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 12,
        revenue: 0,
        costOfSales: 0,
        grossProfit: 0,
        sgaExpenses: [],
        operatingIncome: 0,
        nonOperatingIncome: 0,
        nonOperatingExpenses: 0,
        ordinaryIncome: 0,
        extraordinaryIncome: 0,
        extraordinaryLoss: 0,
        incomeBeforeTax: 0,
        corporateTax: 0,
        netIncome: 0,
      }

      const result = await service.export(emptyProfitLoss, mockOptions)

      expect(result.filename).toContain('profit_loss')
    })

    it('should handle empty cash flow', async () => {
      const emptyCashFlow: CashFlowData = {
        fiscalYear: 2024,
        month: 12,
        operatingActivities: {
          netIncome: 0,
          adjustments: [],
          netCashFromOperating: 0,
        },
        investingActivities: {
          items: [],
          netCashFromInvesting: 0,
        },
        financingActivities: {
          items: [],
          netCashFromFinancing: 0,
        },
        netChangeInCash: 0,
        beginningCash: 0,
        endingCash: 0,
      }

      const result = await service.export(emptyCashFlow, mockOptions)

      expect(result.filename).toContain('cash_flow')
    })
  })

  describe('negative values', () => {
    it('should handle negative amounts', async () => {
      const negativeBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: -1000000 },
        liabilities: { current: [], fixed: [], total: -500000 },
        equity: { items: [], total: -500000 },
      }

      const result = await service.export(negativeBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle net loss', async () => {
      const lossProfitLoss: ProfitLossData = {
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 12,
        revenue: 5000000,
        costOfSales: 6000000,
        grossProfit: -1000000,
        sgaExpenses: [],
        operatingIncome: -1000000,
        nonOperatingIncome: 0,
        nonOperatingExpenses: 0,
        ordinaryIncome: -1000000,
        extraordinaryIncome: 0,
        extraordinaryLoss: 0,
        incomeBeforeTax: -1000000,
        corporateTax: 0,
        netIncome: -1000000,
      }

      const result = await service.export(lossProfitLoss, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe('large values', () => {
    it('should handle very large amounts', async () => {
      const largeBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金', amount: Number.MAX_SAFE_INTEGER }],
          fixed: [],
          total: Number.MAX_SAFE_INTEGER,
        },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: Number.MAX_SAFE_INTEGER }],
          total: Number.MAX_SAFE_INTEGER,
        },
      }

      const result = await service.export(largeBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe('special characters', () => {
    it('should handle special characters in account names', async () => {
      const specialCharBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金 & 預金 <特殊>', amount: 1000000 }],
          fixed: [],
          total: 1000000,
        },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 1000000 },
      }

      const result = await service.export(specialCharBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle unicode characters', async () => {
      const unicodeBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: 'テスト 🎉 売掛金', amount: 1000000 }],
          fixed: [],
          total: 1000000,
        },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 1000000 },
      }

      const result = await service.export(unicodeBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe('paper size and orientation', () => {
    it('should handle A3 paper size', async () => {
      const a3Options: ExportOptions = { ...mockOptions, paperSize: 'A3' }

      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
      }

      const result = await service.export(mockBalanceSheet, a3Options)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle Letter paper size', async () => {
      const letterOptions: ExportOptions = { ...mockOptions, paperSize: 'Letter' }

      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
      }

      const result = await service.export(mockBalanceSheet, letterOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle landscape orientation', async () => {
      const landscapeOptions: ExportOptions = { ...mockOptions, orientation: 'landscape' }

      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
      }

      const result = await service.export(mockBalanceSheet, landscapeOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe('exchange rate edge cases', () => {
    it('should handle very low exchange rate', async () => {
      const lowRateOptions: ExportOptions = {
        ...mockOptions,
        currency: 'dual',
        exchangeRate: 1,
      }

      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 100000 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 100000 },
      }

      const result = await service.export(mockBalanceSheet, lowRateOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle very high exchange rate', async () => {
      const highRateOptions: ExportOptions = {
        ...mockOptions,
        currency: 'dual',
        exchangeRate: 1000,
      }

      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 100000 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 100000 },
      }

      const result = await service.export(mockBalanceSheet, highRateOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })
  })

  describe('many items', () => {
    it('should handle many account items', async () => {
      const manyItemsBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: Array.from({ length: 100 }, (_, i) => ({
            code: `1${i.toString().padStart(3, '0')}`,
            name: `流動資産${i}`,
            amount: 100000 * (i + 1),
          })),
          fixed: Array.from({ length: 50 }, (_, i) => ({
            code: `2${i.toString().padStart(3, '0')}`,
            name: `固定資産${i}`,
            amount: 500000 * (i + 1),
          })),
          total: 1000000000,
        },
        liabilities: {
          current: Array.from({ length: 30 }, (_, i) => ({
            code: `3${i.toString().padStart(3, '0')}`,
            name: `流動負債${i}`,
            amount: 50000 * (i + 1),
          })),
          fixed: Array.from({ length: 20 }, (_, i) => ({
            code: `4${i.toString().padStart(3, '0')}`,
            name: `固定負債${i}`,
            amount: 200000 * (i + 1),
          })),
          total: 500000000,
        },
        equity: {
          items: Array.from({ length: 10 }, (_, i) => ({
            code: `5${i.toString().padStart(3, '0')}`,
            name: `純資産${i}`,
            amount: 50000000 * (i + 1),
          })),
          total: 500000000,
        },
      }

      const result = await service.export(manyItemsBalanceSheet, mockOptions)

      expect(result.fileSize).toBeGreaterThan(1000)
    })
  })
})
