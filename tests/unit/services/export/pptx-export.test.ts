import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PPTXExportService, createPPTXExportService } from '@/services/export/pptx-export'
import type {
  ExportOptions,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  MonthlyReportData,
  KPIData,
} from '@/services/export/types'

describe('PPTXExportService', () => {
  let service: PPTXExportService

  const mockOptions: ExportOptions = {
    format: 'pptx',
    language: 'ja',
    paperSize: 'A4',
    orientation: 'landscape',
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
    sgaExpenses: [{ code: 'E001', name: '給与手当', amount: 1500000 }],
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
      adjustments: [],
      netCashFromOperating: 2000000,
    },
    investingActivities: {
      items: [],
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

  const mockKPI: KPIData = {
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
      { key: 'revenue_growth', name: '売上成長率', nameEn: 'Revenue Growth', value: 15, unit: '%' },
    ],
    cashFlow: [{ key: 'fcf', name: 'FCF', nameEn: 'Free Cash Flow', value: 1500000, unit: '円' }],
  }

  const mockMonthlyReport: MonthlyReportData = {
    fiscalYear: 2024,
    month: 12,
    balanceSheet: mockBalanceSheet,
    profitLoss: mockProfitLoss,
    cashFlow: mockCashFlow,
    summary: {
      highlights: ['売上高が前月比10%増加'],
      issues: ['在庫回転率が低下'],
      nextMonthGoals: ['売上5%増加'],
    },
    kpi: mockKPI,
  }

  beforeEach(() => {
    service = new PPTXExportService()
    vi.clearAllMocks()
  })

  describe('export', () => {
    it('should export balance sheet to PPTX', async () => {
      const result = await service.export(mockBalanceSheet, mockOptions)

      expect(result.filename).toContain('balance_sheet')
      expect(result.filename).toContain('.pptx')
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
      expect(result.downloadUrl).toBeDefined()
      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should export profit loss to PPTX', async () => {
      const result = await service.export(mockProfitLoss, mockOptions)

      expect(result.filename).toContain('profit_loss')
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    })

    it('should export cash flow to PPTX', async () => {
      const result = await service.export(mockCashFlow, mockOptions)

      expect(result.filename).toContain('cash_flow')
    })

    it('should export KPI to PPTX', async () => {
      const result = await service.export(mockKPI, mockOptions)

      expect(result.filename).toContain('kpi')
    })

    it('should export monthly report to PPTX', async () => {
      const result = await service.export(mockMonthlyReport, mockOptions)

      expect(result.filename).toContain('monthly_report')
    })
  })

  describe('getSupportedFormats', () => {
    it('should return pptx as supported format', () => {
      const formats = service.getSupportedFormats()

      expect(formats).toContain('pptx')
    })
  })

  describe('slide creation', () => {
    it('should create title slide', async () => {
      const result = await service.export(mockMonthlyReport, mockOptions)

      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should create multiple slides for monthly report', async () => {
      const result = await service.export(mockMonthlyReport, mockOptions)

      expect(result.fileSize).toBeGreaterThan(100)
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
  })
})

describe('createPPTXExportService', () => {
  it('should create PPTXExportService instance', () => {
    const service = createPPTXExportService()

    expect(service).toBeInstanceOf(PPTXExportService)
  })
})

describe('PPTXExportService edge cases', () => {
  let service: PPTXExportService

  const mockOptions: ExportOptions = {
    format: 'pptx',
    language: 'ja',
    paperSize: 'A4',
    orientation: 'landscape',
    currency: 'JPY',
    includeCharts: true,
  }

  beforeEach(() => {
    service = new PPTXExportService()
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

      expect(result.filename).toContain('balance_sheet')
    })

    it('should handle empty KPI data', async () => {
      const emptyKPI: KPIData = {
        fiscalYear: 2024,
        month: 12,
        profitability: [],
        efficiency: [],
        safety: [],
        growth: [],
        cashFlow: [],
      }

      const result = await service.export(emptyKPI, mockOptions)

      expect(result.filename).toContain('kpi')
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

    it('should handle negative cash flow', async () => {
      const negativeCashFlow: CashFlowData = {
        fiscalYear: 2024,
        month: 12,
        operatingActivities: {
          netIncome: -1000000,
          adjustments: [],
          netCashFromOperating: -1500000,
        },
        investingActivities: {
          items: [],
          netCashFromInvesting: -500000,
        },
        financingActivities: {
          items: [],
          netCashFromFinancing: 2000000,
        },
        netChangeInCash: 0,
        beginningCash: 1000000,
        endingCash: 1000000,
      }

      const result = await service.export(negativeCashFlow, mockOptions)

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
  })

  describe('monthly report with various data', () => {
    it('should handle monthly report with empty highlights', async () => {
      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
      }

      const mockProfitLoss: ProfitLossData = {
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

      const mockCashFlow: CashFlowData = {
        fiscalYear: 2024,
        month: 12,
        operatingActivities: { netIncome: 0, adjustments: [], netCashFromOperating: 0 },
        investingActivities: { items: [], netCashFromInvesting: 0 },
        financingActivities: { items: [], netCashFromFinancing: 0 },
        netChangeInCash: 0,
        beginningCash: 0,
        endingCash: 0,
      }

      const mockKPI: KPIData = {
        fiscalYear: 2024,
        month: 12,
        profitability: [],
        efficiency: [],
        safety: [],
        growth: [],
        cashFlow: [],
      }

      const monthlyReport: MonthlyReportData = {
        fiscalYear: 2024,
        month: 12,
        balanceSheet: mockBalanceSheet,
        profitLoss: mockProfitLoss,
        cashFlow: mockCashFlow,
        kpi: mockKPI,
        summary: {
          highlights: [],
          issues: [],
          nextMonthGoals: [],
        },
      }

      const result = await service.export(monthlyReport, mockOptions)

      expect(result.filename).toContain('monthly_report')
    })

    it('should handle monthly report with many highlights', async () => {
      const mockBalanceSheet: BalanceSheetData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
      }

      const mockProfitLoss: ProfitLossData = {
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

      const mockCashFlow: CashFlowData = {
        fiscalYear: 2024,
        month: 12,
        operatingActivities: { netIncome: 0, adjustments: [], netCashFromOperating: 0 },
        investingActivities: { items: [], netCashFromInvesting: 0 },
        financingActivities: { items: [], netCashFromFinancing: 0 },
        netChangeInCash: 0,
        beginningCash: 0,
        endingCash: 0,
      }

      const mockKPI: KPIData = {
        fiscalYear: 2024,
        month: 12,
        profitability: [],
        efficiency: [],
        safety: [],
        growth: [],
        cashFlow: [],
      }

      const monthlyReport: MonthlyReportData = {
        fiscalYear: 2024,
        month: 12,
        balanceSheet: mockBalanceSheet,
        profitLoss: mockProfitLoss,
        cashFlow: mockCashFlow,
        kpi: mockKPI,
        summary: {
          highlights: Array.from({ length: 20 }, (_, i) => `ハイライト ${i}`),
          issues: Array.from({ length: 10 }, (_, i) => `課題 ${i}`),
          nextMonthGoals: Array.from({ length: 5 }, (_, i) => `目標 ${i}`),
        },
      }

      const result = await service.export(monthlyReport, mockOptions)

      expect(result.fileSize).toBeGreaterThan(1000)
    })
  })

  describe('KPI data variations', () => {
    it('should handle KPI with many items', async () => {
      const manyKPI: KPIData = {
        fiscalYear: 2024,
        month: 12,
        profitability: Array.from({ length: 10 }, (_, i) => ({
          key: `prof_${i}`,
          name: `収益性指標${i}`,
          nameEn: `Profitability ${i}`,
          value: 10 + i,
          unit: '%',
        })),
        efficiency: Array.from({ length: 10 }, (_, i) => ({
          key: `eff_${i}`,
          name: `効率性指標${i}`,
          nameEn: `Efficiency ${i}`,
          value: 1 + i * 0.1,
          unit: '回',
        })),
        safety: Array.from({ length: 10 }, (_, i) => ({
          key: `saf_${i}`,
          name: `安全性指標${i}`,
          nameEn: `Safety ${i}`,
          value: 100 + i,
          unit: '%',
        })),
        growth: Array.from({ length: 10 }, (_, i) => ({
          key: `gro_${i}`,
          name: `成長性指標${i}`,
          nameEn: `Growth ${i}`,
          value: 5 + i,
          unit: '%',
        })),
        cashFlow: Array.from({ length: 10 }, (_, i) => ({
          key: `cf_${i}`,
          name: `CF指標${i}`,
          nameEn: `CF ${i}`,
          value: 1000000 * (i + 1),
          unit: '円',
        })),
      }

      const result = await service.export(manyKPI, mockOptions)

      expect(result.filename).toContain('kpi')
    })
  })
})
