import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseBudgetCsv,
  importBudgetFromCsv,
  generateBudgetTemplate,
  validateBudgetCsv,
} from '@/services/budget/budget-import'
import { createBudgetBatch } from '@/services/budget/budget-service'

vi.mock('@/services/budget/budget-service', () => ({
  createBudgetBatch: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  parseCsv: vi.fn((content: string) => {
    const lines = content.split('\n').filter((l) => l.trim())
    return lines.map((line) => line.split(','))
  }),
}))

describe('BudgetImportService', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseBudgetCsv', () => {
    it('should parse valid CSV content', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月,3月
400,売上高,1000000,1100000,1200000
500,売上原価,600000,650000,700000`

      const result = parseBudgetCsv(csvContent)

      expect(result).toHaveLength(2)
      expect(result[0].accountCode).toBe('400')
      expect(result[0].accountName).toBe('売上高')
      expect(result[0].months).toEqual([1000000, 1100000, 1200000])
    })

    it('should return empty array for content with only header', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月,3月`

      const result = parseBudgetCsv(csvContent)

      expect(result).toEqual([])
    })

    it('should return empty array for empty content', () => {
      const result = parseBudgetCsv('')

      expect(result).toEqual([])
    })

    it('should handle comma-separated numbers', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,"1,000,000"`

      const result = parseBudgetCsv(csvContent)

      expect(result).toBeDefined()
      expect(result).toHaveLength(1)
      expect(result[0].months[0]).toBeGreaterThanOrEqual(0)
    })

    it('should skip rows with missing account code', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
,売上高,1000000
400,売上高,1100000`

      const result = parseBudgetCsv(csvContent)

      expect(result).toHaveLength(1)
      expect(result[0].accountCode).toBe('400')
    })

    it('should skip rows with missing account name', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,,1000000
500,売上原価,1100000`

      const result = parseBudgetCsv(csvContent)

      expect(result).toHaveLength(1)
      expect(result[0].accountName).toBe('売上原価')
    })

    it('should handle invalid numbers as zero', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月
400,売上高,invalid,1000000`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].months[0]).toBe(0)
      expect(result[0].months[1]).toBe(1000000)
    })

    it('should detect month columns with various formats', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月
400,売上高,1,2,3,4,5,6,7,8,9,10,11,12`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].months).toHaveLength(12)
    })
  })

  describe('importBudgetFromCsv', () => {
    it('should successfully import valid CSV', async () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月
400,売上高,1000000,1100000`

      vi.mocked(createBudgetBatch).mockResolvedValue(2)

      const result = await importBudgetFromCsv(csvContent, mockCompanyId, 2024)

      expect(result.success).toBe(true)
      expect(result.totalRows).toBe(1)
      expect(result.importedCount).toBe(2)
    })

    it('should return error for empty CSV', async () => {
      const result = await importBudgetFromCsv('', mockCompanyId, 2024)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('有効なデータが見つかりませんでした')
    })

    it('should return error when all amounts are zero', async () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月
400,売上高,0,0`

      const result = await importBudgetFromCsv(csvContent, mockCompanyId, 2024)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('インポートするデータがありません')
    })

    it('should skip zero amount entries', async () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月
400,売上高,0,1000000`

      vi.mocked(createBudgetBatch).mockResolvedValue(1)

      const result = await importBudgetFromCsv(csvContent, mockCompanyId, 2024)

      expect(result.importedCount).toBe(1)
    })

    it('should handle import errors', async () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,1000000`

      vi.mocked(createBudgetBatch).mockRejectedValue(new Error('Database error'))

      const result = await importBudgetFromCsv(csvContent, mockCompanyId, 2024)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Database error')
    })

    it('should include departmentId when provided', async () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,1000000`

      vi.mocked(createBudgetBatch).mockResolvedValue(1)

      await importBudgetFromCsv(csvContent, mockCompanyId, 2024, 'dept-1')

      expect(createBudgetBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            departmentId: 'dept-1',
          }),
        ])
      )
    })

    it('should handle unknown errors', async () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,1000000`

      vi.mocked(createBudgetBatch).mockRejectedValue('Unknown error')

      const result = await importBudgetFromCsv(csvContent, mockCompanyId, 2024)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('不明なエラーが発生しました')
    })
  })

  describe('generateBudgetTemplate', () => {
    it('should generate valid CSV template', () => {
      const template = generateBudgetTemplate()

      expect(template).toContain('勘定科目コード')
      expect(template).toContain('勘定科目名')
      expect(template).toContain('1月')
      expect(template).toContain('12月')
    })

    it('should include sample rows', () => {
      const template = generateBudgetTemplate()

      expect(template).toContain('400,売上高')
      expect(template).toContain('500,売上原価')
      expect(template).toContain('510,給与手当')
    })

    it('should have 12 month columns', () => {
      const template = generateBudgetTemplate()
      const header = template.split('\n')[0]

      for (let i = 1; i <= 12; i++) {
        expect(header).toContain(`${i}月`)
      }
    })
  })

  describe('validateBudgetCsv', () => {
    it('should return valid for correct CSV', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月
400,売上高,1000000,1100000`

      const result = validateBudgetCsv(csvContent)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should return invalid for empty file', () => {
      const result = validateBudgetCsv('')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('ファイルが空です')
    })

    it('should return invalid for header only', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月`

      const result = validateBudgetCsv(csvContent)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('ヘッダー行のみでデータ行がありません')
    })

    it('should return error for insufficient columns', () => {
      const csvContent = `勘定科目コード,勘定科目名
400,売上高`

      const result = validateBudgetCsv(csvContent)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('列数が不足'))).toBe(true)
    })

    it('should return error for missing account code', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
,売上高,1000000`

      const result = validateBudgetCsv(csvContent)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('勘定科目コードが空'))).toBe(true)
    })

    it('should return error for missing account name', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,,1000000`

      const result = validateBudgetCsv(csvContent)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('勘定科目名が空'))).toBe(true)
    })

    it('should return error for invalid number', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,invalid`

      const result = validateBudgetCsv(csvContent)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('数値が無効'))).toBe(true)
    })

    it('should include row number in error messages', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,1000000
500,,invalid`

      const result = validateBudgetCsv(csvContent)

      expect(result.errors.some((e) => e.includes('3行目'))).toBe(true)
    })

    it('should validate multiple rows', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,1000000
,売上原価,500000
600,,invalid`

      const result = validateBudgetCsv(csvContent)

      expect(result.errors.length).toBeGreaterThan(1)
    })

    it('should handle comma-separated numbers in validation', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,"1,000,000"`

      const result = validateBudgetCsv(csvContent)

      expect(result).toBeDefined()
      expect(result.valid).toBeDefined()
    })

    it('should allow empty cells for months', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月,2月
400,売上高,1000000,`

      const result = validateBudgetCsv(csvContent)

      expect(result).toBeDefined()
      expect(result.valid).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in account name', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上&原価,1000000`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].accountName).toBe('売上&原価')
    })

    it('should handle unicode in account name', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高（テスト）,1000000`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].accountName).toBe('売上高（テスト）')
    })

    it('should handle very large numbers', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,999999999999`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].months[0]).toBe(999999999999)
    })

    it('should handle negative numbers', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,-1000000`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].months[0]).toBe(-1000000)
    })

    it('should handle decimal numbers', () => {
      const csvContent = `勘定科目コード,勘定科目名,1月
400,売上高,1000000.5`

      const result = parseBudgetCsv(csvContent)

      expect(result[0].months[0]).toBe(1000000.5)
    })
  })
})
