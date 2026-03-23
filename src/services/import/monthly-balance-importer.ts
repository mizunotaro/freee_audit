import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  success,
  failure,
  type Result,
  type AppError,
  createAppError,
  ERROR_CODES,
} from '@/types/result'
import {
  IMPORT_LIMITS,
  DEFAULT_IMPORT_OPTIONS,
  type ImportError,
  type ImportOptions,
  type ImportContext,
  type ImportErrorCode,
  type ParseResult,
} from './types'
import { CsvParser } from './parsers/csv-parser'
import { ExcelParser } from './parsers/excel-parser'

export const MonthlyBalanceImportSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  accountCode: z.string().min(1),
  accountName: z.string().min(1),
  category: z.string().min(1),
  amount: z.number(),
})

export type MonthlyBalanceImportRow = z.infer<typeof MonthlyBalanceImportSchema>

interface ImportResultData {
  success: boolean
  imported: number
  skipped: number
  failed: number
  errors: ImportError[]
  warnings: string[]
  totalRows: number
  validRows: number
}

const HEADER_MAPPINGS: Record<string, string> = {
  年度: 'fiscalYear',
  fiscal_year: 'fiscalYear',
  fiscalYear: 'fiscalYear',
  月: 'month',
  month: 'month',
  勘定科目コード: 'accountCode',
  account_code: 'accountCode',
  accountCode: 'accountCode',
  勘定科目名: 'accountName',
  科目名: 'accountName',
  account_name: 'accountName',
  accountName: 'accountName',
  カテゴリ: 'category',
  区分: 'category',
  category: 'category',
  金額: 'amount',
  残高: 'amount',
  amount: 'amount',
}

const REQUIRED_HEADERS = ['fiscalYear', 'month', 'accountCode', 'accountName', 'category', 'amount']

const CATEGORY_MAP: Record<string, string> = {
  流動資産: 'current_asset',
  current_asset: 'current_asset',
  固定資産: 'fixed_asset',
  fixed_asset: 'fixed_asset',
  繰延資産: 'deferred_asset',
  deferred_asset: 'deferred_asset',
  流動負債: 'current_liability',
  current_liability: 'current_liability',
  固定負債: 'fixed_liability',
  fixed_liability: 'fixed_liability',
  繰延負債: 'deferred_liability',
  deferred_liability: 'deferred_liability',
  純資産: 'equity',
  equity: 'equity',
  売上: 'revenue',
  売上高: 'revenue',
  revenue: 'revenue',
  費用: 'expense',
  expense: 'expense',
  経費: 'expense',
}

export class MonthlyBalanceImporter {
  private readonly csvParser: CsvParser
  private readonly excelParser: ExcelParser

  constructor() {
    this.csvParser = new CsvParser({
      headerMappings: HEADER_MAPPINGS,
      requiredHeaders: REQUIRED_HEADERS,
    })
    this.excelParser = new ExcelParser({
      headerMappings: HEADER_MAPPINGS,
      requiredHeaders: REQUIRED_HEADERS,
    })
  }

  async preview(file: File): Promise<Result<ParseResult, AppError>> {
    return this.parseFile(file)
  }

  async import(
    file: File,
    context: ImportContext,
    options: Partial<ImportOptions> = {}
  ): Promise<Result<ImportResultData, AppError>> {
    const mergedOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options }

    const parseResult = await this.parseFile(file)
    if (!parseResult.success) {
      return parseResult
    }

    const { rows, warnings } = parseResult.data

    if (rows.length === 0) {
      return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'No valid data found in file'))
    }

    const { valid, invalid } = this.validateRows(rows)

    if (valid.length === 0) {
      return success({
        success: false,
        imported: 0,
        skipped: 0,
        failed: invalid.length,
        errors: invalid.flatMap((i) => i.errors).slice(0, IMPORT_LIMITS.MAX_ERRORS_DISPLAY),
        warnings,
        totalRows: rows.length,
        validRows: 0,
      })
    }

    if (mergedOptions.dryRun) {
      return success({
        success: true,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        warnings,
        totalRows: rows.length,
        validRows: valid.length,
      })
    }

    let imported = 0
    let skipped = 0
    const importErrors: ImportError[] = []

    for (const row of valid) {
      try {
        const normalizedCategory = CATEGORY_MAP[row.category.toLowerCase()] ?? row.category

        const existing = await prisma.monthlyBalance.findFirst({
          where: {
            companyId: context.companyId,
            fiscalYear: row.fiscalYear,
            month: row.month,
            accountCode: row.accountCode,
          },
        })

        if (existing) {
          if (mergedOptions.skipDuplicates) {
            skipped++
            continue
          }
          if (mergedOptions.updateExisting) {
            await prisma.monthlyBalance.update({
              where: { id: existing.id },
              data: {
                accountName: row.accountName,
                category: normalizedCategory,
                amount: row.amount,
              },
            })
            imported++
            continue
          }
        }

        await prisma.monthlyBalance.create({
          data: {
            companyId: context.companyId,
            fiscalYear: row.fiscalYear,
            month: row.month,
            accountCode: row.accountCode,
            accountName: row.accountName,
            category: normalizedCategory,
            amount: row.amount,
          },
        })
        imported++
      } catch (error) {
        importErrors.push({
          row: valid.indexOf(row) + 2,
          code: 'DATABASE_ERROR' as ImportErrorCode,
          message: error instanceof Error ? error.message : 'Unknown database error',
          severity: 'error',
        })
      }
    }

    return success({
      success: imported > 0,
      imported,
      skipped,
      failed: importErrors.length,
      errors: [...invalid.flatMap((i) => i.errors), ...importErrors].slice(
        0,
        IMPORT_LIMITS.MAX_ERRORS_DISPLAY
      ),
      warnings,
      totalRows: rows.length,
      validRows: valid.length,
    })
  }

  private async parseFile(file: File): Promise<Result<ParseResult, AppError>> {
    const extension = file.name.toLowerCase().split('.').pop()

    if (extension === 'csv') {
      const content = await file.text()
      return this.csvParser.parse(content)
    }

    if (['xlsx', 'xls', 'xlsm'].includes(extension ?? '')) {
      return this.excelParser.parse(file)
    }

    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, `Unsupported file type: ${extension}`)
    )
  }

  private validateRows(rows: Record<string, unknown>[]): {
    valid: MonthlyBalanceImportRow[]
    invalid: Array<{ row: number; errors: ImportError[] }>
  } {
    const valid: MonthlyBalanceImportRow[] = []
    const invalid: Array<{ row: number; errors: ImportError[] }> = []

    rows.forEach((row, index) => {
      const transformedRow = {
        fiscalYear:
          typeof row.fiscalYear === 'string' ? parseInt(row.fiscalYear, 10) : row.fiscalYear,
        month: typeof row.month === 'string' ? parseInt(row.month, 10) : row.month,
        accountCode: String(row.accountCode ?? ''),
        accountName: String(row.accountName ?? ''),
        category: String(row.category ?? ''),
        amount:
          typeof row.amount === 'string'
            ? parseFloat(row.amount.replace(/,/g, '')) || 0
            : typeof row.amount === 'number'
              ? row.amount
              : 0,
      }

      const result = MonthlyBalanceImportSchema.safeParse(transformedRow)
      if (result.success) {
        valid.push(result.data)
      } else {
        const errors: ImportError[] = result.error.errors.map((err) => ({
          row: index + 2,
          code: 'VALIDATION_ERROR' as ImportErrorCode,
          message: `${err.path.join('.')}: ${err.message}`,
          severity: 'error' as const,
        }))
        invalid.push({ row: index + 2, errors })
      }
    })

    return { valid, invalid }
  }

  generateTemplate(language: 'ja' | 'en' = 'ja'): string {
    if (language === 'en') {
      const headers = ['fiscal_year', 'month', 'account_code', 'account_name', 'category', 'amount']
      const sampleRows = [
        ['2024', '1', '100', 'Cash', 'current_asset', '500000'],
        ['2024', '1', '200', 'Accounts Payable', 'current_liability', '300000'],
        ['2024', '1', '400', 'Sales', 'revenue', '1000000'],
      ]
      return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n')
    }

    const headers = ['年度', '月', '勘定科目コード', '勘定科目名', 'カテゴリ', '金額']
    const sampleRows = [
      ['2024', '1', '100', '現金', '流動資産', '500000'],
      ['2024', '1', '200', '買掛金', '流動負債', '300000'],
      ['2024', '1', '400', '売上高', '売上', '1000000'],
    ]
    return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n')
  }
}

export const monthlyBalanceImporter = new MonthlyBalanceImporter()
