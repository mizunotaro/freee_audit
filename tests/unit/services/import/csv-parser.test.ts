import { describe, it, expect, beforeEach } from 'vitest'
import { CsvParser, type CsvParserOptions } from '@/services/import/parsers/csv-parser'

describe('CsvParser', () => {
  let parser: CsvParser

  const defaultOptions: CsvParserOptions = {
    headerMappings: {
      日付: 'entryDate',
      date: 'entryDate',
      摘要: 'description',
      description: 'description',
      金額: 'amount',
      amount: 'amount',
    },
    requiredHeaders: ['entryDate', 'description', 'amount'],
  }

  beforeEach(() => {
    parser = new CsvParser(defaultOptions)
  })

  describe('parse', () => {
    it('should parse valid CSV content', async () => {
      const csvContent = `日付,摘要,金額
2024-01-15,売上計上,110000
2024-01-16,経費支払,50000`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.headers).toEqual(['日付', '摘要', '金額'])
        expect(result.data.mappedHeaders).toEqual({
          日付: 'entryDate',
          摘要: 'description',
          金額: 'amount',
        })
        expect(result.data.rows).toHaveLength(2)
        expect(result.data.totalRows).toBe(2)
      }
    })

    it('should parse English headers', async () => {
      const csvContent = `date,description,amount
2024-01-15,Sales entry,110000
2024-01-16,Expense payment,50000`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.detectedLanguage).toBe('en')
        expect(result.data.rows).toHaveLength(2)
      }
    })

    it('should detect Japanese language', async () => {
      const csvContent = `日付,摘要,金額
2024-01-15,売上計上,110000`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.detectedLanguage).toBe('ja')
      }
    })

    it('should fail on missing required headers', async () => {
      const csvContent = `日付,摘要
2024-01-15,売上計上`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(false)
    })

    it('should handle empty content', async () => {
      const csvContent = ''

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(false)
    })

    it('should fail on header-only content (no data rows)', async () => {
      const csvContent = '日付,摘要,金額'

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('at least one data row')
      }
    })

    it('should handle quoted values', async () => {
      const csvContent = `日付,摘要,金額
"2024-01-15","売上,計上","110000"`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rows[0].description).toBe('売上,計上')
      }
    })

    it('should skip empty rows', async () => {
      const csvContent = `日付,摘要,金額
2024-01-15,売上計上,110000

2024-01-16,経費支払,50000`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rows).toHaveLength(2)
      }
    })

    it('should fail when row count exceeds maxRows limit', async () => {
      const limitedParser = new CsvParser({
        ...defaultOptions,
        maxRows: 2,
      })

      const csvContent = `日付,摘要,金額
2024-01-15,売上計上,110000
2024-01-16,経費支払,50000
2024-01-17,その他,30000`

      const result = await limitedParser.parse(csvContent)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('exceeds')
      }
    })
  })

  describe('sanitizeValue', () => {
    it('should remove control characters', async () => {
      const csvContent = `日付,摘要,金額
2024-01-15,売上\x00計上,110000`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rows[0].description).toBe('売上計上')
      }
    })

    it('should trim whitespace', async () => {
      const csvContent = `日付,摘要,金額
2024-01-15,  売上計上  ,110000`

      const result = await parser.parse(csvContent)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rows[0].description).toBe('売上計上')
      }
    })
  })
})
