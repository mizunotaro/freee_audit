import { z } from 'zod'
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
  IMPORT_CONFIG_VERSION as _IMPORT_CONFIG_VERSION,
  DEFAULT_IMPORT_OPTIONS,
  type ImportType,
  type ImportOptions,
  type ImportResult,
  type ImportError,
  type ImportPreview,
  type ValidationResult,
  type ParseResult,
  type ImportErrorCode,
  getErrorMessage as _getErrorMessage,
} from './types'
import { CsvParser, type CsvParserOptions } from './parsers/csv-parser'
import { ExcelParser, type ExcelParserOptions } from './parsers/excel-parser'

export interface BaseImporterConfig<T> {
  type: ImportType
  schema: z.ZodSchema<T>
  requiredHeaders: string[]
  headerMappings: Record<string, string>
  modelName: string
}

export interface ImportContext {
  companyId: string
  userId?: string
  jobId?: string
}

const CHUNK_SIZE = IMPORT_LIMITS.BATCH_SIZE

export abstract class BaseImporter<T> {
  protected readonly config: BaseImporterConfig<T>
  protected readonly csvParser: CsvParser
  protected readonly excelParser: ExcelParser

  constructor(config: BaseImporterConfig<T>) {
    this.config = config
    const parserOptions: CsvParserOptions & ExcelParserOptions = {
      headerMappings: config.headerMappings,
      requiredHeaders: config.requiredHeaders,
    }
    this.csvParser = new CsvParser(parserOptions)
    this.excelParser = new ExcelParser(parserOptions)
  }

  get type(): ImportType {
    return this.config.type
  }

  async preview(
    file: File,
    _language: 'ja' | 'en' = 'ja'
  ): Promise<Result<ImportPreview, AppError>> {
    const parseResult = await this.parseFile(file)
    if (!parseResult.success) {
      return parseResult
    }

    const { headers, mappedHeaders, rows, warnings, detectedLanguage } = parseResult.data

    const previewRows = rows.slice(0, IMPORT_LIMITS.PREVIEW_ROWS)
    const sampleErrors: ImportError[] = []

    previewRows.forEach((row, index) => {
      const validation = this.validateRow(row, index + 2)
      if (!validation.success) {
        sampleErrors.push(validation.error)
      }
    })

    return success({
      type: this.config.type,
      headers,
      mappedHeaders,
      rows: previewRows,
      totalRows: rows.length,
      detectedLanguage,
      warnings,
      sampleErrors,
    })
  }

  async import(
    file: File,
    context: ImportContext,
    options: Partial<ImportOptions> = {}
  ): Promise<Result<ImportResult<T>, AppError>> {
    const startTime = Date.now()
    const mergedOptions: ImportOptions = {
      ...DEFAULT_IMPORT_OPTIONS,
      ...options,
    }

    const parseResult = await this.parseFile(file)
    if (!parseResult.success) {
      return parseResult
    }

    const { rows, warnings: parseWarnings } = parseResult.data

    if (rows.length === 0) {
      return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'No valid data found in file'))
    }

    const validationResult = this.validateRows(rows)
    const { valid, invalid } = validationResult

    const errors: ImportError[] = []
    const importWarnings: ImportError[] = parseWarnings.map((w, i) => ({
      row: i + 1,
      code: 'PARSE_WARNING' as ImportErrorCode,
      message: w,
      severity: 'warning' as const,
    }))

    invalid.forEach(({ row: _row, errors: rowErrors }) => {
      errors.push(...rowErrors)
    })

    if (valid.length === 0) {
      return success({
        success: false,
        status: 'failed',
        imported: 0,
        skipped: 0,
        failed: invalid.length,
        errors: errors.slice(0, IMPORT_LIMITS.MAX_ERRORS_DISPLAY),
        warnings: importWarnings,
        totalRows: rows.length,
        validRows: 0,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      })
    }

    if (mergedOptions.dryRun) {
      return success({
        success: true,
        status: 'previewing',
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        warnings: importWarnings,
        totalRows: rows.length,
        validRows: valid.length,
        data: valid,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      })
    }

    const importResult = await this.executeImport(valid, context, mergedOptions)

    return success({
      ...importResult,
      errors: [...importResult.errors, ...errors].slice(0, IMPORT_LIMITS.MAX_ERRORS_DISPLAY),
      warnings: importWarnings,
      totalRows: rows.length,
      validRows: valid.length,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    })
  }

  protected async parseFile(file: File): Promise<Result<ParseResult, AppError>> {
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

  protected validateRows(rows: Record<string, unknown>[]): ValidationResult<T> {
    const valid: T[] = []
    const invalid: Array<{ row: number; data: unknown; errors: ImportError[] }> = []

    rows.forEach((row, index) => {
      const result = this.validateRow(row, index + 2)
      if (result.success) {
        valid.push(result.data)
      } else {
        invalid.push({
          row: index + 2,
          data: row,
          errors: [result.error],
        })
      }
    })

    return { valid, invalid }
  }

  protected validateRow(row: Record<string, unknown>, rowNumber: number): Result<T, ImportError> {
    const result = this.config.schema.safeParse(row)

    if (result.success) {
      return success(result.data)
    }

    const errors: ImportError[] = result.error.errors.map((err) => ({
      row: rowNumber,
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

    return failure(
      errors[0] ?? {
        row: rowNumber,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        severity: 'error',
      }
    )
  }

  protected async executeImport(
    validRows: T[],
    context: ImportContext,
    options: ImportOptions
  ): Promise<
    Omit<ImportResult<T>, 'warnings' | 'totalRows' | 'validRows' | 'timestamp' | 'durationMs'>
  > {
    let imported = 0
    let skipped = 0
    const errors: ImportError[] = []

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE)

      for (const row of chunk) {
        try {
          const result = await this.importSingleRow(row, context, options)

          if (result.success) {
            if (result.data === 'imported') {
              imported++
            } else {
              skipped++
            }
          } else {
            errors.push(result.error)
          }
        } catch (error) {
          errors.push({
            row: i + validRows.indexOf(row) + 2,
            code: 'DATABASE_ERROR',
            message: error instanceof Error ? error.message : 'Unknown database error',
            severity: 'error',
          })
        }
      }
    }

    const hasPartialSuccess = imported > 0 && errors.length > 0

    return {
      success: imported > 0,
      status: hasPartialSuccess ? 'partial' : errors.length === 0 ? 'completed' : 'failed',
      imported,
      skipped,
      failed: errors.length,
      errors,
    }
  }

  protected abstract importSingleRow(
    row: T,
    context: ImportContext,
    options: ImportOptions
  ): Promise<Result<'imported' | 'skipped', ImportError>>

  abstract generateTemplate(language: 'ja' | 'en'): string
}
