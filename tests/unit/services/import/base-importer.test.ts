import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  BaseImporter,
  type BaseImporterConfig,
  type ImportContext,
} from '@/services/import/base-importer'
import { success, failure } from '@/types/result'

vi.mock('@/services/import/parsers/csv-parser', () => ({
  CsvParser: vi.fn().mockImplementation(function (this: any) {
    this.parse = vi.fn()
  }),
}))

vi.mock('@/services/import/parsers/excel-parser', () => ({
  ExcelParser: vi.fn().mockImplementation(function (this: any) {
    this.parse = vi.fn()
  }),
}))

const TestSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
})

class TestImporter extends BaseImporter<{ name: string; amount: number }> {
  constructor() {
    super({
      type: 'journal',
      schema: TestSchema,
      requiredHeaders: ['name', 'amount'],
      headerMappings: { 名前: 'name', 金額: 'amount' },
      modelName: 'Test',
    })
  }

  protected async importSingleRow(
    row: { name: string; amount: number },
    _context: ImportContext,
    _options: any
  ): Promise<any> {
    return success('imported' as const)
  }

  generateTemplate(language: 'ja' | 'en'): string {
    return language === 'ja' ? '名前,金額' : 'name,amount'
  }
}

describe('BaseImporter', () => {
  let importer: TestImporter

  beforeEach(function () {
    importer = new TestImporter()
  })

  describe('type', () => {
    it('should return the configured import type', function () {
      expect(importer.type).toBe('journal')
    })
  })

  describe('generateTemplate', () => {
    it('should generate Japanese template', function () {
      expect(importer.generateTemplate('ja')).toBe('名前,金額')
    })

    it('should generate English template', function () {
      expect(importer.generateTemplate('en')).toBe('name,amount')
    })
  })

  describe('validateRow', () => {
    it('should validate a valid row', function () {
      const result = (importer as any).validateRow({ name: 'Test', amount: 100 }, 2)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'Test', amount: 100 })
      }
    })

    it('should return error for invalid row', function () {
      const result = (importer as any).validateRow({ name: '', amount: -1 }, 2)

      expect(result.success).toBe(false)
    })
  })

  describe('validateRows', () => {
    it('should separate valid and invalid rows', function () {
      const rows = [
        { name: 'Valid', amount: 100 },
        { name: '', amount: -1 },
      ]

      const result = (importer as any).validateRows(rows)

      expect(result.valid).toHaveLength(1)
      expect(result.invalid).toHaveLength(1)
    })
  })

  describe('parseFile', () => {
    it('should reject unsupported file types', async function () {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' })

      const result = await (importer as any).parseFile(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Unsupported file type')
      }
    })
  })

  describe('import', () => {
    it('should reject empty rows', async function () {
      const parseSpy = vi.spyOn(importer as any, 'parseFile').mockResolvedValue(
        success({
          headers: [],
          mappedHeaders: {},
          rows: [],
          totalRows: 0,
          detectedLanguage: 'ja',
          warnings: [],
        })
      )

      const file = new File(['data'], 'test.csv', { type: 'text/csv' })
      const result = await importer.import(file, { companyId: 'co-1' })

      expect(result.success).toBe(false)
    })
  })
})
