import * as XLSX from 'xlsx'
import type { AccountCategory } from '@/types/conversion'
import { COAValidator, type ValidationError } from './coa-validator'

export interface ParsedCOAItem {
  code: string
  name: string
  nameEn: string
  category: string
  subcategory?: string
  normalBalance: string
  parentCode?: string
  isConvertible: boolean
}

export interface ResolvedItem extends ParsedCOAItem {
  parentId?: string
  level: number
}

export interface ImportParseResult {
  success: boolean
  items: ParsedCOAItem[]
  errors: ImportError[]
  warnings: ImportError[]
}

export interface ImportError {
  row: number
  code: string
  message: string
  field?: string
}

const MAX_FILE_SIZE_CSV = 5 * 1024 * 1024
const MAX_FILE_SIZE_EXCEL = 10 * 1024 * 1024
const MAX_ROWS = 10000

const CATEGORY_MAPPING: Record<string, AccountCategory> = {
  current_asset: 'current_asset',
  current_assets: 'current_asset',
  fixed_asset: 'fixed_asset',
  fixed_assets: 'fixed_asset',
  deferred_asset: 'deferred_asset',
  deferred_assets: 'deferred_asset',
  current_liability: 'current_liability',
  current_liabilities: 'current_liability',
  fixed_liability: 'fixed_liability',
  fixed_liabilities: 'fixed_liability',
  deferred_liability: 'deferred_liability',
  deferred_liabilities: 'deferred_liability',
  equity: 'equity',
  net_assets: 'equity',
  revenue: 'revenue',
  sales: 'revenue',
  cogs: 'cogs',
  cost_of_sales: 'cogs',
  sga_expense: 'sga_expense',
  sga_expenses: 'sga_expense',
  non_operating_income: 'non_operating_income',
  non_operating_expense: 'non_operating_expense',
  extraordinary_income: 'extraordinary_income',
  extraordinary_loss: 'extraordinary_loss',
  special_income: 'extraordinary_income',
  special_loss: 'extraordinary_loss',
}

const REQUIRED_COLUMNS = ['code', 'name', 'name_en', 'category', 'normal_balance']

export class COAImporter {
  private validator = new COAValidator()

  async parseCSV(file: File): Promise<ImportParseResult> {
    if (file.size > MAX_FILE_SIZE_CSV) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'FILE_TOO_LARGE',
            message: `ファイルサイズが上限を超えています（上限: ${MAX_FILE_SIZE_CSV / 1024 / 1024}MB）`,
          },
        ],
        warnings: [],
      }
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim())

    if (lines.length > MAX_ROWS + 1) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'TOO_MANY_ROWS',
            message: `行数が上限を超えています（上限: ${MAX_ROWS}行）`,
          },
        ],
        warnings: [],
      }
    }

    if (lines.length < 2) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'NO_DATA',
            message: 'データが含まれていません',
          },
        ],
        warnings: [],
      }
    }

    const headerLine = lines[0]
    const headers = this.parseCSVLine(headerLine).map((h) => h.toLowerCase().trim())

    const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col))
    if (missingColumns.length > 0) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 1,
            code: 'MISSING_COLUMNS',
            message: `必須カラムが不足しています: ${missingColumns.join(', ')}`,
          },
        ],
        warnings: [],
      }
    }

    const codeIndex = headers.indexOf('code')
    const nameIndex = headers.indexOf('name')
    const nameEnIndex = headers.indexOf('name_en')
    const categoryIndex = headers.indexOf('category')
    const subcategoryIndex = headers.indexOf('subcategory')
    const normalBalanceIndex = headers.indexOf('normal_balance')
    const parentCodeIndex = headers.indexOf('parent_code')
    const isConvertibleIndex = headers.indexOf('is_convertible')

    const items: ParsedCOAItem[] = []
    const errors: ImportError[] = []
    const warnings: ImportError[] = []

    for (let i = 1; i < lines.length; i++) {
      const row = i + 1
      const values = this.parseCSVLine(lines[i])

      if (values.length < REQUIRED_COLUMNS.length) {
        errors.push({
          row,
          code: 'INSUFFICIENT_COLUMNS',
          message: `カラム数が不足しています（必要: ${REQUIRED_COLUMNS.length}, 実際: ${values.length}）`,
        })
        continue
      }

      const code = values[codeIndex]?.trim()
      const name = values[nameIndex]?.trim()
      const nameEn = values[nameEnIndex]?.trim()
      const categoryRaw = values[categoryIndex]?.trim().toLowerCase()
      const subcategory = subcategoryIndex >= 0 ? values[subcategoryIndex]?.trim() : undefined
      const normalBalanceRaw = values[normalBalanceIndex]?.trim().toLowerCase()
      const parentCode = parentCodeIndex >= 0 ? values[parentCodeIndex]?.trim() : undefined
      const isConvertibleRaw =
        isConvertibleIndex >= 0 ? values[isConvertibleIndex]?.trim().toLowerCase() : 'true'

      if (!code) {
        errors.push({
          row,
          code: 'REQUIRED_FIELD',
          message: '勘定科目コードは必須です',
          field: 'code',
        })
        continue
      }

      if (!name) {
        errors.push({
          row,
          code: 'REQUIRED_FIELD',
          message: '勘定科目名は必須です',
          field: 'name',
        })
        continue
      }

      if (!nameEn) {
        errors.push({
          row,
          code: 'REQUIRED_FIELD',
          message: '勘定科目名（英語）は必須です',
          field: 'name_en',
        })
        continue
      }

      const category = CATEGORY_MAPPING[categoryRaw]
      if (!category) {
        errors.push({
          row,
          code: 'INVALID_CATEGORY',
          message: `無効なカテゴリです: ${categoryRaw}`,
          field: 'category',
        })
        continue
      }

      if (!['debit', 'credit'].includes(normalBalanceRaw)) {
        errors.push({
          row,
          code: 'INVALID_NORMAL_BALANCE',
          message: `借方/貸方は "debit" または "credit" で指定してください: ${normalBalanceRaw}`,
          field: 'normal_balance',
        })
        continue
      }

      const isConvertible = isConvertibleRaw === 'true' || isConvertibleRaw === '1'

      items.push({
        code,
        name,
        nameEn,
        category,
        subcategory: subcategory || undefined,
        normalBalance: normalBalanceRaw,
        parentCode: parentCode || undefined,
        isConvertible,
      })
    }

    const duplicateErrors = this.checkDuplicateCodes(items)
    errors.push(...duplicateErrors)

    return {
      success: errors.length === 0,
      items,
      errors,
      warnings,
    }
  }

  async parseExcel(file: File): Promise<ImportParseResult> {
    if (file.size > MAX_FILE_SIZE_EXCEL) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'FILE_TOO_LARGE',
            message: `ファイルサイズが上限を超えています（上限: ${MAX_FILE_SIZE_EXCEL / 1024 / 1024}MB）`,
          },
        ],
        warnings: [],
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'NO_SHEET',
            message: 'シートが見つかりません',
          },
        ],
        warnings: [],
      }
    }

    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

    if (jsonData.length > MAX_ROWS + 1) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'TOO_MANY_ROWS',
            message: `行数が上限を超えています（上限: ${MAX_ROWS}行）`,
          },
        ],
        warnings: [],
      }
    }

    if (jsonData.length < 2) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 0,
            code: 'NO_DATA',
            message: 'データが含まれていません',
          },
        ],
        warnings: [],
      }
    }

    const headers = (jsonData[0] as string[]).map((h) =>
      String(h || '')
        .toLowerCase()
        .trim()
    )

    const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col))
    if (missingColumns.length > 0) {
      return {
        success: false,
        items: [],
        errors: [
          {
            row: 1,
            code: 'MISSING_COLUMNS',
            message: `必須カラムが不足しています: ${missingColumns.join(', ')}`,
          },
        ],
        warnings: [],
      }
    }

    const codeIndex = headers.indexOf('code')
    const nameIndex = headers.indexOf('name')
    const nameEnIndex = headers.indexOf('name_en')
    const categoryIndex = headers.indexOf('category')
    const subcategoryIndex = headers.indexOf('subcategory')
    const normalBalanceIndex = headers.indexOf('normal_balance')
    const parentCodeIndex = headers.indexOf('parent_code')
    const isConvertibleIndex = headers.indexOf('is_convertible')

    const items: ParsedCOAItem[] = []
    const errors: ImportError[] = []
    const warnings: ImportError[] = []

    for (let i = 1; i < jsonData.length; i++) {
      const row = i + 1
      const values = jsonData[i]

      const code = String(values[codeIndex] || '').trim()
      const name = String(values[nameIndex] || '').trim()
      const nameEn = String(values[nameEnIndex] || '').trim()
      const categoryRaw = String(values[categoryIndex] || '')
        .toLowerCase()
        .trim()
      const subcategory =
        subcategoryIndex >= 0 ? String(values[subcategoryIndex] || '').trim() : undefined
      const normalBalanceRaw = String(values[normalBalanceIndex] || '')
        .toLowerCase()
        .trim()
      const parentCode =
        parentCodeIndex >= 0 ? String(values[parentCodeIndex] || '').trim() : undefined
      const isConvertibleRaw =
        isConvertibleIndex >= 0
          ? String(values[isConvertibleIndex] || 'true')
              .toLowerCase()
              .trim()
          : 'true'

      if (!code) {
        errors.push({
          row,
          code: 'REQUIRED_FIELD',
          message: '勘定科目コードは必須です',
          field: 'code',
        })
        continue
      }

      if (!name) {
        errors.push({
          row,
          code: 'REQUIRED_FIELD',
          message: '勘定科目名は必須です',
          field: 'name',
        })
        continue
      }

      if (!nameEn) {
        errors.push({
          row,
          code: 'REQUIRED_FIELD',
          message: '勘定科目名（英語）は必須です',
          field: 'name_en',
        })
        continue
      }

      const category = CATEGORY_MAPPING[categoryRaw]
      if (!category) {
        errors.push({
          row,
          code: 'INVALID_CATEGORY',
          message: `無効なカテゴリです: ${categoryRaw}`,
          field: 'category',
        })
        continue
      }

      if (!['debit', 'credit'].includes(normalBalanceRaw)) {
        errors.push({
          row,
          code: 'INVALID_NORMAL_BALANCE',
          message: `借方/貸方は "debit" または "credit" で指定してください: ${normalBalanceRaw}`,
          field: 'normal_balance',
        })
        continue
      }

      const isConvertible = isConvertibleRaw === 'true' || isConvertibleRaw === '1'

      items.push({
        code,
        name,
        nameEn,
        category,
        subcategory: subcategory || undefined,
        normalBalance: normalBalanceRaw,
        parentCode: parentCode || undefined,
        isConvertible,
      })
    }

    const duplicateErrors = this.checkDuplicateCodes(items)
    errors.push(...duplicateErrors)

    return {
      success: errors.length === 0,
      items,
      errors,
      warnings,
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }

    result.push(current)
    return result
  }

  private checkDuplicateCodes(items: ParsedCOAItem[]): ImportError[] {
    const errors: ImportError[] = []
    const codeSet = new Set<string>()
    const duplicates = new Set<string>()

    items.forEach((item, _index) => {
      if (codeSet.has(item.code)) {
        duplicates.add(item.code)
      } else {
        codeSet.add(item.code)
      }
    })

    if (duplicates.size > 0) {
      errors.push({
        row: 0,
        code: 'DUPLICATE_CODES',
        message: `重複する勘定科目コードがあります: ${Array.from(duplicates).join(', ')}`,
      })
    }

    return errors
  }

  validateParsedData(items: ParsedCOAItem[]): { isValid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = []

    for (const item of items) {
      const itemErrors = this.validator.validateItem({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category as AccountCategory,
        subcategory: item.subcategory,
        normalBalance: item.normalBalance as 'debit' | 'credit',
        isConvertible: item.isConvertible,
      })
      errors.push(...itemErrors)
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
