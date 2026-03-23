import {
  success,
  failure,
  type Result,
  type AppError,
  createAppError,
  ERROR_CODES,
} from '@/types/result'
import { IMPORT_LIMITS, type ParseResult, type ImportError } from '../types'

export interface CsvParserOptions {
  headerMappings: Record<string, string>
  requiredHeaders: string[]
  maxRows?: number
  language?: 'ja' | 'en'
  delimiter?: string
}

const DEFAULT_OPTIONS: Partial<CsvParserOptions> = {
  maxRows: IMPORT_LIMITS.MAX_ROWS,
  language: 'ja',
  delimiter: ',',
}

export class CsvParser {
  private readonly options: CsvParserOptions

  constructor(options: CsvParserOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async parse(content: string): Promise<Result<ParseResult, AppError>> {
    if (!content.trim()) {
      return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'File is empty'))
    }

    const sanitizedContent = this.sanitizeContent(content)

    try {
      const lines = this.splitLines(sanitizedContent)

      if (lines.length < 2) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            'CSV file must have header row and at least one data row'
          )
        )
      }

      if (lines.length - 1 > (this.options.maxRows ?? IMPORT_LIMITS.MAX_ROWS)) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Row count exceeds ${this.options.maxRows} limit (${lines.length - 1} rows)`
          )
        )
      }

      const rawHeaders = this.parseCsvLine(lines[0])
      const { mappedHeaders, detectedLanguage, unknownHeaders, missingHeaders } =
        this.mapHeaders(rawHeaders)

      if (missingHeaders.length > 0) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Missing required headers: ${missingHeaders.join(', ')}`,
            { details: { missingHeaders, availableHeaders: rawHeaders } }
          )
        )
      }

      const rows: Record<string, unknown>[] = []
      const warnings: string[] = []
      const errors: ImportError[] = []

      if (unknownHeaders.length > 0) {
        warnings.push(`Unknown headers: ${unknownHeaders.join(', ')}`)
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        const values = this.parseCsvLine(line)

        if (values.length < rawHeaders.length) {
          errors.push({
            row: i + 1,
            code: 'VALIDATION_ERROR',
            message: `Insufficient columns (expected ${rawHeaders.length}, got ${values.length})`,
            severity: 'error',
          })
          continue
        }

        const row: Record<string, unknown> = {}
        rawHeaders.forEach((header, index) => {
          const value = values[index]?.trim() ?? ''
          const mappedKey = mappedHeaders[header]
          if (mappedKey) {
            row[mappedKey] = this.sanitizeValue(value)
          }
        })

        const sanitizationResult = this.sanitizeRow(row, i + 1)
        warnings.push(...sanitizationResult.warnings)
        if (sanitizationResult.error) {
          errors.push(sanitizationResult.error)
        } else {
          rows.push(sanitizationResult.data)
        }
      }

      return success({
        headers: rawHeaders,
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
          error instanceof Error ? error.message : 'Failed to parse CSV file'
        )
      )
    }
  }

  private splitLines(content: string): string[] {
    return content.split(/\r?\n/).filter((line) => line.trim())
  }

  private parseCsvLine(line: string): string[] {
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
      } else if (char === this.options.delimiter && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)

    return result
  }

  private mapHeaders(rawHeaders: string[]): {
    mappedHeaders: Record<string, string>
    detectedLanguage: 'ja' | 'en' | 'unknown'
    unknownHeaders: string[]
    missingHeaders: string[]
  } {
    const mappedHeaders: Record<string, string> = {}
    const unknownHeaders: string[] = []
    let jaCount = 0
    let enCount = 0

    rawHeaders.forEach((header) => {
      const normalizedHeader = header.trim()
      const mapping = this.options.headerMappings[normalizedHeader]

      if (mapping) {
        mappedHeaders[normalizedHeader] = mapping
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(normalizedHeader)) {
          jaCount++
        } else {
          enCount++
        }
      } else {
        unknownHeaders.push(normalizedHeader)
        mappedHeaders[normalizedHeader] = normalizedHeader
      }
    })

    const missingHeaders = this.options.requiredHeaders.filter(
      (h) => !Object.values(mappedHeaders).includes(h)
    )

    const detectedLanguage: 'ja' | 'en' | 'unknown' =
      jaCount > enCount ? 'ja' : enCount > 0 ? 'en' : 'unknown'

    return { mappedHeaders, detectedLanguage, unknownHeaders, missingHeaders }
  }

  private sanitizeContent(content: string): string {
    return content
      .replace(/\uFEFF/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
  }

  private sanitizeValue(value: string, maxLength: number = 10000): string {
    return (
      value
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/^["']|["']$/g, '')
        .slice(0, maxLength)
        .trim()
    )
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
        const sanitizedValue = this.sanitizeValue(value)
        if (sanitizedValue !== value) {
          warnings.push(`Row ${rowNumber}: Sanitized value in "${key}"`)
        }
        sanitized[key] = sanitizedValue
      } else {
        sanitized[key] = value
      }
    }

    return { data: sanitized, warnings, error: undefined }
  }
}
