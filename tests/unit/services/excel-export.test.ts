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
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})
