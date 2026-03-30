import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExcelParser } from '@/services/import/parsers/excel-parser'

vi.mock('exceljs', () => {
  const mockWorksheet = {
    eachRow: vi.fn((callback) => {
      callback({
        eachCell: vi.fn((opts, cb) => {
          cb({ value: '科目ID', col: 1 })
          cb({ value: '科目名', col: 2 })
          cb({ value: 'カテゴリ', col: 3 })
        }),
      })
      callback({
        eachCell: vi.fn((opts, cb) => {
          cb({ value: '1001', col: 1 })
          cb({ value: '現金', col: 2 })
          cb({ value: '資産', col: 3 })
        }),
      })
    }),
  }

  const Workbook = vi.fn(function () {
    return {
      xlsx: {
        load: vi.fn().mockResolvedValue(undefined),
      },
      worksheets: [mockWorksheet],
    }
  })

  return { default: { Workbook }, Workbook }
})

const headerMappings = {
  科目ID: 'freeeId',
  科目名: 'name',
  カテゴリ: 'category',
  freee_id: 'freeeId',
  name: 'name',
  category: 'category',
}

const requiredHeaders = ['freeeId', 'name', 'category']

describe('ExcelParser', () => {
  let parser: ExcelParser

  beforeEach(() => {
    parser = new ExcelParser({
      headerMappings,
      requiredHeaders,
    })
  })

  describe('parse', () => {
    it('rejects invalid file extension', async () => {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' })
      const result = await parser.parse(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Invalid file type')
      }
    })

    it('rejects oversized file', async () => {
      const largeFile = {
        name: 'test.xlsx',
        size: 20 * 1024 * 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      } as unknown as File

      const result = await parser.parse(largeFile)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('size exceeds')
      }
    })
  })

  describe('header mapping', () => {
    it('maps Japanese headers correctly', async () => {
      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const result = await parser.parse(file)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mappedHeaders['科目ID']).toBe('freeeId')
        expect(result.data.detectedLanguage).toBe('ja')
      }
    })
  })

  describe('constructor', () => {
    it('uses default maxRows', () => {
      const p = new ExcelParser({ headerMappings, requiredHeaders })
      expect(p).toBeDefined()
    })

    it('accepts custom options', () => {
      const p = new ExcelParser({
        headerMappings,
        requiredHeaders,
        maxRows: 500,
        language: 'en',
      })
      expect(p).toBeDefined()
    })
  })

  describe('getSheetNames', () => {
    it('delegates to parse', async () => {
      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const result = await parser.getSheetNames(file)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    })
  })

  describe('sanitizeString', () => {
    it('removes control characters', () => {
      const parser = new ExcelParser({ headerMappings, requiredHeaders })
      const sanitized = parser['sanitizeString']('hello\x00world\x1F')
      expect(sanitized).toBe('helloworld')
    })

    it('trims and slices to maxLength', () => {
      const parser = new ExcelParser({ headerMappings, requiredHeaders })
      const longStr = 'a'.repeat(20000)
      const sanitized = parser['sanitizeString'](longStr, 100)
      expect(sanitized.length).toBe(100)
    })
  })
})
