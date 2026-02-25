import { parseCsv } from '@/lib/utils'
import { createBudgetBatch, type CreateBudgetInput } from './budget-service'

export interface BudgetImportRow {
  accountCode: string
  accountName: string
  months: number[]
}

export interface BudgetImportResult {
  success: boolean
  totalRows: number
  importedCount: number
  errors: string[]
}

export function parseBudgetCsv(content: string): BudgetImportRow[] {
  const rows = parseCsv(content)
  if (rows.length < 2) {
    return []
  }

  const header = rows[0]
  const dataRows = rows.slice(1)

  const monthColumns: number[] = []
  for (let i = 2; i < header.length; i++) {
    const col = header[i]
    const monthMatch = col.match(/(\d+)月?/)
    if (monthMatch) {
      monthColumns.push(parseInt(monthMatch[1]))
    }
  }

  const result: BudgetImportRow[] = []

  for (const row of dataRows) {
    if (row.length < 2) continue

    const accountCode = row[0].trim()
    const accountName = row[1].trim()

    if (!accountCode || !accountName) continue

    const months: number[] = []
    for (let i = 0; i < monthColumns.length && i + 2 < row.length; i++) {
      const value = parseFloat(row[i + 2].replace(/,/g, ''))
      months.push(isNaN(value) ? 0 : value)
    }

    result.push({
      accountCode,
      accountName,
      months,
    })
  }

  return result
}

export async function importBudgetFromCsv(
  content: string,
  companyId: string,
  fiscalYear: number,
  departmentId?: string
): Promise<BudgetImportResult> {
  const errors: string[] = []

  try {
    const rows = parseBudgetCsv(content)

    if (rows.length === 0) {
      return {
        success: false,
        totalRows: 0,
        importedCount: 0,
        errors: ['有効なデータが見つかりませんでした'],
      }
    }

    const budgetInputs: CreateBudgetInput[] = []

    for (const row of rows) {
      for (let i = 0; i < row.months.length; i++) {
        const month = i + 1
        const amount = row.months[i]

        if (amount === 0) continue

        budgetInputs.push({
          companyId,
          fiscalYear,
          month,
          departmentId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          amount,
        })
      }
    }

    if (budgetInputs.length === 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedCount: 0,
        errors: ['インポートするデータがありません'],
      }
    }

    const importedCount = await createBudgetBatch(budgetInputs)

    return {
      success: true,
      totalRows: rows.length,
      importedCount,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      totalRows: 0,
      importedCount: 0,
      errors: [error instanceof Error ? error.message : '不明なエラーが発生しました'],
    }
  }
}

export function generateBudgetTemplate(): string {
  const header = '勘定科目コード,勘定科目名,1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月'
  const rows = [
    '400,売上高,5000000,5200000,5400000,5600000,5800000,6000000,6200000,6400000,6600000,6800000,7000000,7500000',
    '500,売上原価,2000000,2100000,2200000,2300000,2400000,2500000,2600000,2700000,2800000,2900000,3000000,3200000',
    '510,給与手当,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000',
    '511,福利厚生費,160000,160000,160000,160000,160000,160000,160000,160000,160000,160000,160000,160000',
    '512,旅費交通費,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000',
    '513,通信費,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000',
    '514,水道光熱費,40000,40000,40000,40000,40000,40000,40000,40000,40000,40000,40000,40000',
    '515,地代家賃,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000',
    '516,広告宣伝費,100000,100000,100000,100000,100000,100000,100000,100000,100000,100000,100000,100000',
    '517,減価償却費,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000',
  ]

  return [header, ...rows].join('\n')
}

export function validateBudgetCsv(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const rows = parseCsv(content)

  if (rows.length === 0) {
    errors.push('ファイルが空です')
    return { valid: false, errors }
  }

  if (rows.length < 2) {
    errors.push('ヘッダー行のみでデータ行がありません')
    return { valid: false, errors }
  }

  const header = rows[0]
  if (header.length < 3) {
    errors.push('列数が不足しています。勘定科目コード、勘定科目名、各月の予算が必要です')
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 2) {
      errors.push(`${i + 1}行目: 勘定科目コードと名称が必要です`)
      continue
    }

    if (!row[0].trim()) {
      errors.push(`${i + 1}行目: 勘定科目コードが空です`)
    }

    if (!row[1].trim()) {
      errors.push(`${i + 1}行目: 勘定科目名が空です`)
    }

    for (let j = 2; j < row.length; j++) {
      const value = row[j].replace(/,/g, '').trim()
      if (value && isNaN(parseFloat(value))) {
        errors.push(`${i + 1}行目${j + 1}列目: 数値が無効です "${value}"`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
