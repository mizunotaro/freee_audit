import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExcelExportService } from '@/services/export/excel-export'

// Mock XLSX library
vi.mock('xlsx', () => ({
  default: {
    utils: {
      book_new: vi.fn(() => ({})),
      aoa_to_sheet: vi.fn(() => ({})),
      book_append_sheet: vi.fn(),
    },
    write: vi.fn(() => Buffer.from('mock-excel-content')),
  },
}))

describe('ExcelExportService', () => {
  let service: ExcelExportService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ExcelExportService()
  })

  describe('getSupportedFormats', () => {
    it('should return supported formats', () => {
      const formats = service.getSupportedFormats()

      expect(formats).toContain('excel')
      expect(formats).toContain('csv')
      expect(formats.length).toBe(2)
    })
  })

  describe('export', () => {
    it('should export balance sheet successfully', async () => {
      const mockData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金', amount: 5000000 }],
          fixed: [],
          total: 5000000,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 5000000 }],
          total: 5000000,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(mockData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toContain('balance_sheet')
      expect(result.filename).toContain('.xlsx')
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(result.downloadUrl).toBeDefined()
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('should handle empty data gracefully', async () => {
      const emptyData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [],
          fixed: [],
          total: 0,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [],
          total: 0,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(emptyData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toBeDefined()
    })
  })

  describe('exportCSV', () => {
    it('should export CSV successfully', async () => {
      const mockData = {
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 12,
        revenue: 10000000,
        costOfSales: 6000000,
        grossProfit: 4000000,
        sgaExpenses: [],
        operatingIncome: 2000000,
        nonOperatingIncome: 100000,
        nonOperatingExpenses: 50000,
        ordinaryIncome: 2050000,
        extraordinaryIncome: 0,
        extraordinaryLoss: 0,
        incomeBeforeTax: 2050000,
        corporateTax: 600000,
        netIncome: 1450000,
      }

      const mockOptions = {
        format: 'csv' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.exportCSV(mockData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toContain('.csv')
      expect(result.mimeType).toBe('text/csv')
    })
  })

  describe('robustness', () => {
    it('should handle large amounts correctly', async () => {
      const largeData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金', amount: Number.MAX_SAFE_INTEGER }],
          fixed: [],
          total: Number.MAX_SAFE_INTEGER,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: Number.MAX_SAFE_INTEGER }],
          total: Number.MAX_SAFE_INTEGER,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(largeData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle negative amounts correctly', async () => {
      const negativeData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金', amount: -1000000 }],
          fixed: [],
          total: -1000000,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: -1000000 }],
          total: -1000000,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(negativeData as any, mockOptions)

      expect(result).toBeDefined()
    })

    it('should handle special characters in account names', async () => {
      const specialCharData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金 & 等価物 <特殊> "引用"', amount: 1000000 }],
          fixed: [],
          total: 1000000,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 1000000 }],
          total: 1000000,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(specialCharData as any, mockOptions)

      expect(result).toBeDefined()
    })
  })

  describe('performance', () => {
    it('should handle large number of items efficiently', async () => {
      const largeData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: Array.from({ length: 1000 }, (_, i) => ({
            code: `A${i.toString().padStart(4, '0')}`,
            name: `勘定科目${i}`,
            amount: 1000000 + i,
          })),
          fixed: [],
          total: 1000000000,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 1000000000 }],
          total: 1000000000,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const startTime = Date.now()
      const result = await service.export(largeData as any, mockOptions)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(5000)
    })
  })

  describe('edge cases', () => {
    it('should handle zero values', async () => {
      const zeroData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金', amount: 0 }],
          fixed: [],
          total: 0,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', amount: 0 }],
          total: 0,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(zeroData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.fileSize).toBeGreaterThan(0)
    })

    it('should handle all empty arrays', async () => {
      const emptyData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [],
          fixed: [],
          total: 0,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [],
          total: 0,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(emptyData as any, mockOptions)

      expect(result).toBeDefined()
    })

    it('should handle dual language', async () => {
      const mockData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: '現金', nameEn: 'Cash', amount: 1000000 }],
          fixed: [],
          total: 1000000,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: '資本金', nameEn: 'Capital', amount: 1000000 }],
          total: 1000000,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'dual' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(mockData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toContain('ja-en')
    })

    it('should handle USD currency', async () => {
      const mockData = {
        fiscalYear: 2024,
        month: 12,
        asOfDate: new Date('2024-12-31'),
        assets: {
          current: [{ code: '1000', name: 'Cash', amount: 10000 }],
          fixed: [],
          total: 10000,
        },
        liabilities: {
          current: [],
          fixed: [],
          total: 0,
        },
        equity: {
          items: [{ code: '5000', name: 'Capital', amount: 10000 }],
          total: 10000,
        },
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'en' as const,
        includeCharts: false,
        currency: 'USD' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(mockData as any, mockOptions)

      expect(result).toBeDefined()
    })

    it('should handle profit loss data', async () => {
      const profitLossData = {
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 12,
        revenue: 10000000,
        costOfSales: 6000000,
        grossProfit: 4000000,
        sgaExpenses: [
          { code: 'E001', name: '給与手当', amount: 2000000 },
          { code: 'E002', name: '広告宣伝費', amount: 500000 },
        ],
        operatingIncome: 1500000,
        nonOperatingIncome: 100000,
        nonOperatingExpenses: 50000,
        ordinaryIncome: 1550000,
        extraordinaryIncome: 0,
        extraordinaryLoss: 0,
        incomeBeforeTax: 1550000,
        corporateTax: 465000,
        netIncome: 1085000,
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(profitLossData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toContain('profit_loss')
    })

    it('should handle cash flow data', async () => {
      const cashFlowData = {
        fiscalYear: 2024,
        month: 12,
        operatingActivities: {
          netIncome: 1000000,
          adjustments: [{ code: 'A001', name: '減価償却費', amount: 300000 }],
          netCashFromOperating: 1300000,
        },
        investingActivities: {
          items: [{ code: 'I001', name: '設備投資', amount: -500000 }],
          netCashFromInvesting: -500000,
        },
        financingActivities: {
          items: [{ code: 'F001', name: '借入', amount: 1000000 }],
          netCashFromFinancing: 1000000,
        },
        netChangeInCash: 1800000,
        beginningCash: 2000000,
        endingCash: 3800000,
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(cashFlowData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toContain('cash_flow')
    })

    it('should handle KPI data', async () => {
      const kpiData = {
        fiscalYear: 2024,
        month: 12,
        profitability: [{ key: 'roe', name: 'ROE', nameEn: 'ROE', value: 15.5, unit: '%' }],
        efficiency: [
          { key: 'turnover', name: '資産回転率', nameEn: 'Asset Turnover', value: 1.2, unit: '回' },
        ],
        safety: [
          {
            key: 'current_ratio',
            name: '流動比率',
            nameEn: 'Current Ratio',
            value: 150,
            unit: '%',
          },
        ],
        growth: [
          {
            key: 'revenue_growth',
            name: '売上成長率',
            nameEn: 'Revenue Growth',
            value: 10,
            unit: '%',
          },
        ],
        cashFlow: [
          {
            key: 'fcf',
            name: 'フリーキャッシュフロー',
            nameEn: 'Free Cash Flow',
            value: 500000,
            unit: '円',
          },
        ],
      }

      const mockOptions = {
        format: 'excel' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.export(kpiData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.filename).toContain('kpi')
    })
  })

  describe('CSV export', () => {
    it('should handle CSV with commas in values', async () => {
      const mockData = {
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 12,
        revenue: 10000000,
        costOfSales: 6000000,
        grossProfit: 4000000,
        sgaExpenses: [{ code: 'E001', name: '給与,手当', amount: 2000000 }],
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

      const mockOptions = {
        format: 'csv' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.exportCSV(mockData as any, mockOptions)

      expect(result).toBeDefined()
      expect(result.mimeType).toBe('text/csv')
    })

    it('should handle CSV with quotes in values', async () => {
      const mockData = {
        fiscalYear: 2024,
        startMonth: 1,
        endMonth: 12,
        revenue: 10000000,
        costOfSales: 6000000,
        grossProfit: 4000000,
        sgaExpenses: [{ code: 'E001', name: '給与"手当"', amount: 2000000 }],
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

      const mockOptions = {
        format: 'csv' as const,
        language: 'ja' as const,
        includeCharts: false,
        currency: 'JPY' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
      }

      const result = await service.exportCSV(mockData as any, mockOptions)

      expect(result).toBeDefined()
    })
  })
})
