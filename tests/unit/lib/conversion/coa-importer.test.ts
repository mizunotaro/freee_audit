import { describe, it, expect, vi } from 'vitest'
import { COAImporter } from '@/lib/conversion/coa-importer'

describe('COAImporter', () => {
  const importer = new COAImporter()

  describe('parseCSV', () => {
    it('should parse valid CSV', async () => {
      const csvContent = `code,name,name_en,category,normal_balance,parent_code,is_convertible
1000,現金及び預金,Cash and Cash Equivalents,current_asset,debit,,true
1100,売掛金,Accounts Receivable,current_asset,debit,,true`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(true)
      expect(result.items).toHaveLength(2)
      expect(result.items[0].code).toBe('1000')
      expect(result.items[0].name).toBe('現金及び預金')
      expect(result.items[1].code).toBe('1100')
    })

    it('should skip invalid rows with errors', async () => {
      const csvContent = `code,name,name_en,category,normal_balance,parent_code,is_convertible
1000,現金及び預金,Cash and Cash Equivalents,current_asset,debit,,true
,売掛金,Accounts Receivable,current_asset,debit,,true
1100,商品,Merchandise,current_asset,debit,,true`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.code === 'REQUIRED_FIELD')).toBe(true)
    })

    it('should reject files over size limit', async () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024)
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE')
    })

    it('should fail with missing required columns', async () => {
      const csvContent = `code,name,name_en
1000,現金及び預金,Cash and Cash Equivalents`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('MISSING_COLUMNS')
    })

    it('should fail with invalid category', async () => {
      const csvContent = `code,name,name_en,category,normal_balance
1000,現金及び預金,Cash,invalid_category,debit`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_CATEGORY')).toBe(true)
    })

    it('should handle quoted CSV values', async () => {
      const csvContent = `code,name,name_en,category,normal_balance
"1000","現金及び預金","Cash and Cash Equivalents","current_asset","debit"`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(true)
      expect(result.items[0].name).toBe('現金及び預金')
    })

    it('should handle parent codes', async () => {
      const csvContent = `code,name,name_en,category,normal_balance,parent_code
1000,資産,Assets,current_asset,debit,
1100,流動資産,Current Assets,current_asset,debit,1000`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(true)
      expect(result.items[1].parentCode).toBe('1000')
    })

    it('should map category aliases', async () => {
      const csvContent = `code,name,name_en,category,normal_balance
1000,現金,Cash,current_assets,debit
2000,売上,Revenue,sales,credit`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await importer.parseCSV(file)

      expect(result.success).toBe(true)
      expect(result.items[0].category).toBe('current_asset')
      expect(result.items[1].category).toBe('revenue')
    })
  })

  describe('parseExcel', () => {
    it('should reject files over size limit', async () => {
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024)
      const file = new File([largeBuffer], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const result = await importer.parseExcel(file)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE')
    })
  })

  describe('validateParsedData', () => {
    it('should validate parsed items', () => {
      const items = [
        {
          code: '1000',
          name: '現金及び預金',
          nameEn: 'Cash',
          category: 'current_asset',
          normalBalance: 'debit',
          isConvertible: true,
        },
      ]

      const result = importer.validateParsedData(items)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid items', () => {
      const items = [
        {
          code: '',
          name: '現金及び預金',
          nameEn: 'Cash',
          category: 'current_asset',
          normalBalance: 'debit',
          isConvertible: true,
        },
      ]

      const result = importer.validateParsedData(items)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
