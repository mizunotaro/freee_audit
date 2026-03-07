import { prisma } from '@/lib/db'
import { z } from 'zod'

export const JournalImportSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式はYYYY-MM-DDで入力してください'),
  description: z.string().min(1, '摘要は必須です'),
  debitAccount: z.string().min(1, '借方科目は必須です'),
  creditAccount: z.string().min(1, '貸方科目は必須です'),
  amount: z.number().positive('金額は正の数で入力してください'),
  taxAmount: z.number().min(0).default(0),
  taxType: z.string().optional(),
})

export type JournalImportRow = z.infer<typeof JournalImportSchema>

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

export interface JournalImportOptions {
  skipDuplicates: boolean
  updateExisting: boolean
}

const REQUIRED_HEADERS = ['entryDate', 'description', 'debitAccount', 'creditAccount', 'amount']
const OPTIONAL_HEADERS = ['taxAmount', 'taxType']

const HEADER_MAPPINGS: Record<string, string> = {
  日付: 'entryDate',
  伝票日付: 'entryDate',
  摘要: 'description',
  借方科目: 'debitAccount',
  借方: 'debitAccount',
  貸方科目: 'creditAccount',
  貸方: 'creditAccount',
  金額: 'amount',
  税額: 'taxAmount',
  消費税額: 'taxAmount',
  税区分: 'taxType',
  消費税区分: 'taxType',
}

export function parseJournalCsv(csvContent: string): JournalImportRow[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSVファイルにはヘッダー行とデータ行が必要です')
  }

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const headers = rawHeaders.map((h) => HEADER_MAPPINGS[h] || h)

  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    throw new Error(`必須ヘッダーが不足しています: ${missingHeaders.join(', ')}`)
  }

  const rows: JournalImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCsvLine(line)
    const row: Record<string, unknown> = {}

    headers.forEach((header, index) => {
      const value = values[index]?.trim().replace(/^"|"$/g, '') || ''
      row[header] = value
    })

    const parsedRow = mapToJournalRow(row)
    if (parsedRow) {
      rows.push(parsedRow)
    }
  }

  return rows
}

function parseCsvLine(line: string): string[] {
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

function mapToJournalRow(row: Record<string, unknown>): JournalImportRow | null {
  const amount =
    typeof row.amount === 'string'
      ? parseFloat(row.amount.replace(/,/g, ''))
      : typeof row.amount === 'number'
        ? row.amount
        : 0

  const taxAmount =
    typeof row.taxAmount === 'string'
      ? parseFloat(row.taxAmount.replace(/,/g, '')) || 0
      : typeof row.taxAmount === 'number'
        ? row.taxAmount
        : 0

  const mappedRow: JournalImportRow = {
    entryDate: String(row.entryDate || ''),
    description: String(row.description || ''),
    debitAccount: String(row.debitAccount || ''),
    creditAccount: String(row.creditAccount || ''),
    amount,
    taxAmount,
    taxType: row.taxType ? String(row.taxType) : undefined,
  }

  return mappedRow
}

export function validateJournalRows(rows: JournalImportRow[]): {
  valid: JournalImportRow[]
  errors: Array<{ row: number; message: string }>
} {
  const valid: JournalImportRow[] = []
  const errors: Array<{ row: number; message: string }> = []

  rows.forEach((row, index) => {
    const result = JournalImportSchema.safeParse(row)
    if (result.success) {
      valid.push(result.data)
    } else {
      result.error.errors.forEach((err) => {
        errors.push({
          row: index + 2,
          message: `${err.path.join('.')}: ${err.message}`,
        })
      })
    }
  })

  return { valid, errors }
}

export async function importJournals(
  rows: JournalImportRow[],
  companyId: string,
  options: JournalImportOptions = { skipDuplicates: true, updateExisting: false }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  const { valid, errors } = validateJournalRows(rows)
  result.errors = errors

  for (const row of valid) {
    try {
      const entryDate = new Date(row.entryDate)
      const uniqueKey = `${companyId}-${row.entryDate}-${row.debitAccount}-${row.creditAccount}-${row.amount}`
      const freeeJournalId = `IMPORT-${Buffer.from(uniqueKey).toString('base64').slice(0, 20)}`

      const existing = await prisma.journal.findUnique({
        where: { freeeJournalId },
      })

      if (existing) {
        if (options.skipDuplicates) {
          result.skipped++
          continue
        }
        if (options.updateExisting) {
          await prisma.journal.update({
            where: { freeeJournalId },
            data: {
              description: row.description,
              taxAmount: row.taxAmount,
              taxType: row.taxType,
              syncedAt: new Date(),
            },
          })
          result.imported++
          continue
        }
      }

      await prisma.journal.create({
        data: {
          companyId,
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
      result.imported++
    } catch (error) {
      result.errors.push({
        row: valid.indexOf(row) + 2,
        message: error instanceof Error ? error.message : '不明なエラー',
      })
    }
  }

  result.success = result.errors.length === 0 || result.imported > 0
  return result
}

export function generateJournalTemplate(): string {
  const headers = ['日付', '摘要', '借方科目', '貸方科目', '金額', '税額', '税区分']
  const sampleRow = ['2024-01-15', '売上計上', '普通預金', '売上高', '110000', '10000', '課税10%']

  return [headers.join(','), sampleRow.join(',')].join('\n')
}
