import { z } from 'zod'
import { prisma } from '@/lib/db'
import { success, failure, type Result } from '@/types/result'
import {
  type ImportError,
  type ImportOptions,
  type ImportContext,
  type ImportErrorCode,
  type ValidationResult,
  DEFAULT_IMPORT_OPTIONS,
} from './types'
import { BaseImporter, type BaseImporterConfig } from './base-importer'

export const JournalImportSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日付形式はYYYY-MM-DDで入力してください',
  }),
  description: z.string().min(1, { message: '摘要は必須です' }),
  debitAccount: z.string().min(1, { message: '借方科目は必須です' }),
  creditAccount: z.string().min(1, { message: '貸方科目は必須です' }),
  amount: z.number().positive({ message: '金額は正の数で入力してください' }),
  taxAmount: z.number().min(0),
  taxType: z.string().optional(),
})

export type JournalImportInput = z.input<typeof JournalImportSchema>

export type JournalImportRow = z.output<typeof JournalImportSchema>

const JOURNAL_HEADER_MAPPINGS: Record<string, string> = {
  日付: 'entryDate',
  伝票日付: 'entryDate',
  date: 'entryDate',
  摘要: 'description',
  description: 'description',
  借方科目: 'debitAccount',
  借方: 'debitAccount',
  debit_account: 'debitAccount',
  debitAccount: 'debitAccount',
  貸方科目: 'creditAccount',
  貸方: 'creditAccount',
  credit_account: 'creditAccount',
  creditAccount: 'creditAccount',
  金額: 'amount',
  amount: 'amount',
  税額: 'taxAmount',
  消費税額: 'taxAmount',
  tax_amount: 'taxAmount',
  taxAmount: 'taxAmount',
  税区分: 'taxType',
  消費税区分: 'taxType',
  tax_type: 'taxType',
  taxType: 'taxType',
}

const JOURNAL_REQUIRED_HEADERS = [
  'entryDate',
  'description',
  'debitAccount',
  'creditAccount',
  'amount',
]

export class JournalImporter extends BaseImporter<JournalImportRow> {
  constructor() {
    const config: BaseImporterConfig<JournalImportRow> = {
      type: 'journal',
      schema: JournalImportSchema,
      requiredHeaders: JOURNAL_REQUIRED_HEADERS,
      headerMappings: JOURNAL_HEADER_MAPPINGS,
      modelName: 'Journal',
    }
    super(config)
  }

  protected override validateRows(
    rows: Record<string, unknown>[]
  ): ValidationResult<JournalImportRow> {
    const valid: JournalImportRow[] = []
    const invalid: Array<{ row: number; data: unknown; errors: ImportError[] }> = []

    rows.forEach((row, index) => {
      const transformedRow: JournalImportInput = {
        entryDate: String(row.entryDate ?? ''),
        description: String(row.description ?? ''),
        debitAccount: String(row.debitAccount ?? ''),
        creditAccount: String(row.creditAccount ?? ''),
        amount:
          typeof row.amount === 'string'
            ? parseFloat(row.amount.replace(/,/g, '')) || 0
            : typeof row.amount === 'number'
              ? row.amount
              : 0,
        taxAmount:
          row.taxAmount === undefined || row.taxAmount === '' || row.taxAmount === null
            ? 0
            : typeof row.taxAmount === 'string'
              ? parseFloat(row.taxAmount.replace(/,/g, '')) || 0
              : typeof row.taxAmount === 'number'
                ? row.taxAmount
                : 0,
        taxType: row.taxType ? String(row.taxType) : undefined,
      }

      const result = JournalImportSchema.safeParse(transformedRow)
      if (result.success) {
        valid.push(result.data)
      } else {
        const errors: ImportError[] = result.error.errors.map((err) => ({
          row: index + 2,
          code: 'VALIDATION_ERROR' as ImportErrorCode,
          message: `${err.path.join('.')}: ${err.message}`,
          field: err.path.join('.'),
          value: err.path.reduce((obj: unknown, key) => {
            if (obj && typeof obj === 'object') {
              return (obj as Record<string, unknown>)[String(key)]
            }
            return undefined
          }, row),
          severity: 'error' as const,
        }))
        invalid.push({ row: index + 2, data: row, errors })
      }
    })

    return { valid, invalid }
  }

  protected async importSingleRow(
    row: JournalImportRow,
    context: ImportContext,
    options: ImportOptions
  ): Promise<Result<'imported' | 'skipped', ImportError>> {
    const mergedOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options }

    try {
      const entryDate = new Date(row.entryDate)
      const uniqueKey = `${context.companyId}-${row.entryDate}-${row.debitAccount}-${row.creditAccount}-${row.amount}`
      const freeeJournalId = `IMPORT-${Buffer.from(uniqueKey).toString('base64').slice(0, 20)}`

      const existing = await prisma.journal.findUnique({
        where: { freeeJournalId },
      })

      if (existing) {
        if (mergedOptions.skipDuplicates) {
          return success('skipped')
        }
        if (mergedOptions.updateExisting) {
          await prisma.journal.update({
            where: { freeeJournalId },
            data: {
              description: row.description,
              taxAmount: row.taxAmount,
              taxType: row.taxType,
              syncedAt: new Date(),
            },
          })
          return success('imported')
        }
        return failure({
          row: 0,
          code: 'DUPLICATE' as ImportErrorCode,
          message: `Duplicate journal entry: ${row.entryDate} ${row.debitAccount}/${row.creditAccount}`,
          severity: 'error',
        })
      }

      await prisma.journal.create({
        data: {
          companyId: context.companyId,
          freeeJournalId,
          entryDate,
          description: row.description,
          debitAccount: row.debitAccount,
          creditAccount: row.creditAccount,
          amount: row.amount,
          taxAmount: row.taxAmount,
          taxType: row.taxType,
          auditStatus: 'PENDING',
          syncedAt: new Date(),
        },
      })

      return success('imported')
    } catch (error) {
      return failure({
        row: 0,
        code: 'DATABASE_ERROR' as ImportErrorCode,
        message: error instanceof Error ? error.message : 'Unknown database error',
        severity: 'error',
      })
    }
  }

  generateTemplate(language: 'ja' | 'en' = 'ja'): string {
    if (language === 'en') {
      const headers = [
        'date',
        'description',
        'debit_account',
        'credit_account',
        'amount',
        'tax_amount',
        'tax_type',
      ]
      const sampleRow = [
        '2024-01-15',
        'Sales entry',
        'Cash',
        'Sales Revenue',
        '110000',
        '10000',
        'Taxable 10%',
      ]
      return [headers.join(','), sampleRow.join(',')].join('\n')
    }

    const headers = ['日付', '摘要', '借方科目', '貸方科目', '金額', '税額', '税区分']
    const sampleRow = ['2024-01-15', '売上計上', '普通預金', '売上高', '110000', '10000', '課税10%']
    return [headers.join(','), sampleRow.join(',')].join('\n')
  }
}

export const journalImporter = new JournalImporter()
