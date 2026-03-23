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

export const AccountItemImportSchema = z.object({
  freeeId: z.number().int().positive({ message: 'freeeIdは正の整数で入力してください' }),
  name: z.string().min(1, { message: '科目名は必須です' }),
  shortcut: z.string().optional(),
  shortcutNum: z.string().optional(),
  categoryId: z.number().int().positive({ message: 'カテゴリIDは正の整数で入力してください' }),
  categoryName: z.string().min(1, { message: 'カテゴリ名は必須です' }),
  categoryType: z.string().min(1, { message: 'カテゴリタイプは必須です' }),
  correspondingIncomeId: z.number().int().optional(),
  correspondingIncomeName: z.string().optional(),
  correspondingExpenseId: z.number().int().optional(),
  correspondingExpenseName: z.string().optional(),
  searchable: z.boolean(),
  cumulable: z.boolean(),
  balance: z.enum(['debit', 'credit'], {
    message: '残高方向はdebitまたはcreditで入力してください',
  }),
})

export type AccountItemImportInput = z.input<typeof AccountItemImportSchema>
export type AccountItemImportRow = z.output<typeof AccountItemImportSchema>

const HEADER_MAPPINGS: Record<string, string> = {
  ID: 'freeeId',
  id: 'freeeId',
  freee_id: 'freeeId',
  freeeId: 'freeeId',
  科目ID: 'freeeId',
  科目名: 'name',
  name: 'name',
  name_ja: 'name',
  略称: 'shortcut',
  shortcut: 'shortcut',
  shortcut_name: 'shortcut',
  略称番号: 'shortcutNum',
  shortcut_num: 'shortcutNum',
  shortcutNum: 'shortcutNum',
  カテゴリID: 'categoryId',
  category_id: 'categoryId',
  categoryId: 'categoryId',
  カテゴリ名: 'categoryName',
  category_name: 'categoryName',
  categoryName: 'categoryName',
  カテゴリタイプ: 'categoryType',
  category_type: 'categoryType',
  categoryType: 'categoryType',
  収入対照ID: 'correspondingIncomeId',
  corresponding_income_id: 'correspondingIncomeId',
  correspondingIncomeId: 'correspondingIncomeId',
  収入対照名: 'correspondingIncomeName',
  corresponding_income_name: 'correspondingIncomeName',
  correspondingIncomeName: 'correspondingIncomeName',
  費用対照ID: 'correspondingExpenseId',
  corresponding_expense_id: 'correspondingExpenseId',
  correspondingExpenseId: 'correspondingExpenseId',
  費用対照名: 'correspondingExpenseName',
  corresponding_expense_name: 'correspondingExpenseName',
  correspondingExpenseName: 'correspondingExpenseName',
  検索可能: 'searchable',
  searchable: 'searchable',
  累積可能: 'cumulable',
  cumulable: 'cumulable',
  残高方向: 'balance',
  balance: 'balance',
  借方貸方: 'balance',
}

const REQUIRED_HEADERS = [
  'freeeId',
  'name',
  'categoryId',
  'categoryName',
  'categoryType',
  'balance',
]

const CATEGORY_TYPE_MAP: Record<string, string> = {
  資産: 'asset',
  asset: 'asset',
  負債: 'liability',
  liability: 'liability',
  純資産: 'equity',
  equity: 'equity',
  収益: 'revenue',
  revenue: 'revenue',
  費用: 'expense',
  expense: 'expense',
  売上: 'revenue',
  経費: 'expense',
}

const BALANCE_MAP: Record<string, 'debit' | 'credit'> = {
  借方: 'debit',
  debit: 'debit',
  dr: 'debit',
  貸方: 'credit',
  credit: 'credit',
  cr: 'credit',
}

export class AccountItemImporter extends BaseImporter<AccountItemImportRow> {
  constructor() {
    const config: BaseImporterConfig<AccountItemImportRow> = {
      type: 'account_item',
      schema: AccountItemImportSchema,
      requiredHeaders: REQUIRED_HEADERS,
      headerMappings: HEADER_MAPPINGS,
      modelName: 'AccountItem',
    }
    super(config)
  }

  protected override validateRows(
    rows: Record<string, unknown>[]
  ): ValidationResult<AccountItemImportRow> {
    const valid: AccountItemImportRow[] = []
    const invalid: Array<{ row: number; data: unknown; errors: ImportError[] }> = []

    rows.forEach((row, index) => {
      const balanceRaw = String(row.balance ?? '').toLowerCase()
      const balance =
        BALANCE_MAP[balanceRaw] ||
        (balanceRaw === 'debit' || balanceRaw === 'credit'
          ? (balanceRaw as 'debit' | 'credit')
          : undefined)

      const transformedRow: AccountItemImportInput = {
        freeeId:
          typeof row.freeeId === 'string'
            ? parseInt(row.freeeId, 10)
            : ((row.freeeId as number) ?? 0),
        name: String(row.name ?? ''),
        shortcut: row.shortcut ? String(row.shortcut) : undefined,
        shortcutNum: row.shortcutNum ? String(row.shortcutNum) : undefined,
        categoryId:
          typeof row.categoryId === 'string'
            ? parseInt(row.categoryId, 10)
            : ((row.categoryId as number) ?? 0),
        categoryName: String(row.categoryName ?? ''),
        categoryType:
          CATEGORY_TYPE_MAP[String(row.categoryType ?? '').toLowerCase()] ??
          String(row.categoryType ?? ''),
        correspondingIncomeId:
          row.correspondingIncomeId !== undefined && row.correspondingIncomeId !== ''
            ? typeof row.correspondingIncomeId === 'string'
              ? parseInt(row.correspondingIncomeId, 10)
              : (row.correspondingIncomeId as number)
            : undefined,
        correspondingIncomeName: row.correspondingIncomeName
          ? String(row.correspondingIncomeName)
          : undefined,
        correspondingExpenseId:
          row.correspondingExpenseId !== undefined && row.correspondingExpenseId !== ''
            ? typeof row.correspondingExpenseId === 'string'
              ? parseInt(row.correspondingExpenseId, 10)
              : (row.correspondingExpenseId as number)
            : undefined,
        correspondingExpenseName: row.correspondingExpenseName
          ? String(row.correspondingExpenseName)
          : undefined,
        searchable:
          typeof row.searchable === 'string'
            ? row.searchable.toLowerCase() === 'true' || row.searchable === '1'
            : Boolean(row.searchable ?? true),
        cumulable:
          typeof row.cumulable === 'string'
            ? row.cumulable.toLowerCase() === 'true' || row.cumulable === '1'
            : Boolean(row.cumulable ?? false),
        balance: balance || 'debit',
      }

      const result = AccountItemImportSchema.safeParse(transformedRow)
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
    row: AccountItemImportRow,
    context: ImportContext,
    options: ImportOptions
  ): Promise<Result<'imported' | 'skipped', ImportError>> {
    const mergedOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options }

    try {
      const existing = await prisma.accountItem.findUnique({
        where: {
          companyId_freeeId: {
            companyId: context.companyId,
            freeeId: row.freeeId,
          },
        },
      })

      if (existing) {
        if (mergedOptions.skipDuplicates) {
          return success('skipped')
        }
        if (mergedOptions.updateExisting) {
          await prisma.accountItem.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              shortcut: row.shortcut,
              shortcutNum: row.shortcutNum,
              categoryId: row.categoryId,
              categoryName: row.categoryName,
              categoryType: row.categoryType,
              correspondingIncomeId: row.correspondingIncomeId,
              correspondingIncomeName: row.correspondingIncomeName,
              correspondingExpenseId: row.correspondingExpenseId,
              correspondingExpenseName: row.correspondingExpenseName,
              searchable: row.searchable,
              cumulable: row.cumulable,
              balance: row.balance,
            },
          })
          return success('imported')
        }
        return failure({
          row: 0,
          code: 'DUPLICATE' as ImportErrorCode,
          message: `Duplicate account item: ${row.freeeId} - ${row.name}`,
          severity: 'error',
        })
      }

      await prisma.accountItem.create({
        data: {
          companyId: context.companyId,
          freeeId: row.freeeId,
          name: row.name,
          shortcut: row.shortcut,
          shortcutNum: row.shortcutNum,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          categoryType: row.categoryType,
          correspondingIncomeId: row.correspondingIncomeId,
          correspondingIncomeName: row.correspondingIncomeName,
          correspondingExpenseId: row.correspondingExpenseId,
          correspondingExpenseName: row.correspondingExpenseName,
          searchable: row.searchable,
          cumulable: row.cumulable,
          balance: row.balance,
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
        'freee_id',
        'name',
        'shortcut',
        'shortcut_num',
        'category_id',
        'category_name',
        'category_type',
        'corresponding_income_id',
        'corresponding_income_name',
        'corresponding_expense_id',
        'corresponding_expense_name',
        'searchable',
        'cumulable',
        'balance',
      ]
      const sampleRows = [
        [
          '1001',
          'Cash',
          'CASH',
          '1',
          '100',
          'Current Assets',
          'asset',
          '',
          '',
          '',
          '',
          'true',
          'false',
          'debit',
        ],
        [
          '2001',
          'Accounts Payable',
          'AP',
          '2',
          '200',
          'Current Liabilities',
          'liability',
          '',
          '',
          '',
          '',
          'true',
          'false',
          'credit',
        ],
        [
          '4001',
          'Sales Revenue',
          'SALES',
          '4',
          '400',
          'Revenue',
          'revenue',
          '',
          '',
          '',
          '',
          'true',
          'false',
          'credit',
        ],
      ]
      return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n')
    }

    const headers = [
      '科目ID',
      '科目名',
      '略称',
      '略称番号',
      'カテゴリID',
      'カテゴリ名',
      'カテゴリタイプ',
      '収入対照ID',
      '収入対照名',
      '費用対照ID',
      '費用対照名',
      '検索可能',
      '累積可能',
      '残高方向',
    ]
    const sampleRows = [
      [
        '1001',
        '現金',
        'ゲンキン',
        '1',
        '100',
        '流動資産',
        '資産',
        '',
        '',
        '',
        '',
        'true',
        'false',
        '借方',
      ],
      [
        '2001',
        '買掛金',
        'カイカケ',
        '2',
        '200',
        '流動負債',
        '負債',
        '',
        '',
        '',
        '',
        'true',
        'false',
        '貸方',
      ],
      [
        '4001',
        '売上高',
        'ウリアゲ',
        '4',
        '400',
        '売上',
        '収益',
        '',
        '',
        '',
        '',
        'true',
        'false',
        '貸方',
      ],
    ]
    return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n')
  }
}

export const accountItemImporter = new AccountItemImporter()
