import ExcelJS from 'exceljs'
import {
  success,
  failure,
  type Result,
  type AppError,
  createAppError,
  ERROR_CODES,
} from '@/types/result'
import { IMPORT_LIMITS, type ParseResult, type ImportError } from '../types'

export interface ExcelParserOptions {
  headerMappings: Record<string, string>
  requiredHeaders: string[]
  maxRows?: number
  language?: 'ja' | 'en'
}

const DEFAULT_OPTIONS: Partial<ExcelParserOptions> = {
  maxRows: IMPORT_LIMITS.MAX_ROWS,
  language: 'ja',
}

export class ExcelParser {
  private readonly options: ExcelParserOptions

  constructor(options: ExcelParserOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async parse(file: File, sheetIndex: number = 0): Promise<Result<ParseResult, AppError>> {
    if (file.size > IMPORT_LIMITS.MAX_FILE_SIZE_EXCEL) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          `File size exceeds ${IMPORT_LIMITS.MAX_FILE_SIZE_EXCEL / 1024 / 1024}MB limit`,
          { details: { maxSize: IMPORT_LIMITS.MAX_FILE_SIZE_EXCEL, actualSize: file.size } }
        )
      )
    }

    const extension = file.name.toLowerCase().split('.').pop()
    if (!['xlsx', 'xls', 'xlsm'].includes(extension ?? '')) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid file type. Expected: .xlsx, .xls, or .xlsm'
        )
      )
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)

      const worksheet = workbook.worksheets[sheetIndex]
      if (!worksheet) {
        return failure(
          createAppError(ERROR_CODES.NOT_FOUND, `Worksheet at index ${sheetIndex} not found`)
        )
      }

      const jsonData = this.extractData(worksheet)

      if (jsonData.length === 0) {
        return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'No data found in worksheet'))
      }

      if (jsonData.length > (this.options.maxRows ?? IMPORT_LIMITS.MAX_ROWS)) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Row count exceeds ${this.options.maxRows} limit (${jsonData.length} rows)`
          )
        )
      }

      const rawHeaders = jsonData[0]
      const { mappedHeaders, detectedLanguage, unknownHeaders } = this.mapHeaders(rawHeaders)

      const missingHeaders = this.options.requiredHeaders.filter(
        (h) => !Object.values(mappedHeaders).includes(h)
      )

      if (missingHeaders.length > 0) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Missing required headers: ${missingHeaders.join(', ')}`,
            { details: { missingHeaders, availableHeaders: Object.keys(mappedHeaders) } }
          )
        )
      }

      const warnings: string[] = []
      if (unknownHeaders.length > 0) {
        warnings.push(`Unknown headers will be ignored: ${unknownHeaders.join(', ')}`)
      }

      const rows: Record<string, unknown>[] = []
      const errors: ImportError[] = []

      for (let i = 1; i < jsonData.length; i++) {
        const rawRow = jsonData[i]
        const mappedRow = this.mapRow(rawRow, rawHeaders, mappedHeaders)

        const sanitizedRow = this.sanitizeRow(mappedRow, i + 2)
        if (sanitizedRow.warnings.length > 0) {
          warnings.push(...sanitizedRow.warnings)
        }
        if (sanitizedRow.error) {
          errors.push(sanitizedRow.error)
        } else {
          rows.push(sanitizedRow.data)
        }
      }

      return success({
        headers: rawHeaders.map((h) => String(h)),
        mappedHeaders,
        rows,
        totalRows: rows.length,
        detectedLanguage,
        warnings,
        errors: errors.length > 0 ? errors : undefined,
      })
    } catch (error) {
      return failure(
        createAppError(
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          error instanceof Error ? error.message : 'Failed to parse Excel file',
          { cause: error instanceof Error ? error : undefined }
        )
      )
    }
  }

  private extractData(worksheet: ExcelJS.Worksheet): unknown[][] {
    const data: unknown[][] = []

    worksheet.eachRow((row) => {
      const rowData: unknown[] = []
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowData[Number(cell.col) - 1] = this.getCellValue(cell)
      })
      data.push(rowData)
    })

    return data
  }

  private getCellValue(cell: ExcelJS.Cell): unknown {
    const value = cell.value

    if (value === null || value === undefined) {
      return ''
    }

    if (typeof value === 'object' && 'result' in value) {
      return (value as ExcelJS.CellFormulaValue).result
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0]
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value
      }
      return Math.round(value * 100) / 100
    }

    return String(value)
  }

  private mapHeaders(rawHeaders: unknown[]): {
    mappedHeaders: Record<string, string>
    detectedLanguage: 'ja' | 'en' | 'unknown'
    unknownHeaders: string[]
  } {
    const mappedHeaders: Record<string, string> = {}
    const unknownHeaders: string[] = []
    let jaCount = 0
    let enCount = 0

    for (const header of rawHeaders) {
      const headerStr = String(header).trim()
      const lowerHeader = headerStr.toLowerCase()

      if (this.options.headerMappings[headerStr]) {
        mappedHeaders[headerStr] = this.options.headerMappings[headerStr]
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(headerStr)) {
          jaCount++
        } else {
          enCount++
        }
      } else if (this.options.headerMappings[lowerHeader]) {
        mappedHeaders[headerStr] = this.options.headerMappings[lowerHeader]
        enCount++
      } else {
        unknownHeaders.push(headerStr)
      }
    }

    const detectedLanguage: 'ja' | 'en' | 'unknown' =
      jaCount > enCount ? 'ja' : enCount > 0 ? 'en' : 'unknown'

    return { mappedHeaders, detectedLanguage, unknownHeaders }
  }

  private mapRow(
    rawRow: unknown[],
    rawHeaders: unknown[],
    mappedHeaders: Record<string, string>
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {}

    rawHeaders.forEach((header, index) => {
      const headerStr = String(header).trim()
      const mappedKey = mappedHeaders[headerStr]
      if (mappedKey) {
        row[mappedKey] = rawRow[index]
      }
    })

    return row
  }

  private sanitizeRow(
    row: Record<string, unknown>,
    rowNumber: number
  ): {
    data: Record<string, unknown>
    warnings: string[]
    error?: ImportError
  } {
    const warnings: string[] = []
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        const sanitizedValue = this.sanitizeString(value)
        if (sanitizedValue !== value) {
          warnings.push(`Row ${rowNumber}: Sanitized control characters in "${key}"`)
        }
        sanitized[key] = sanitizedValue
      } else {
        sanitized[key] = value
      }
    }

    return { data: sanitized, warnings, error: undefined }
  }

  private sanitizeString(value: string, maxLength: number = 10000): string {
    return (
      value
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        .slice(0, maxLength)
        .trim()
    )
  }

  getSheetNames(file: File): Promise<Result<string[], AppError>> {
    return this.parse(file).then((result) => {
      if (!result.success) {
        return result
      }
      return success(Object.keys(result.data))
    })
  }
}
