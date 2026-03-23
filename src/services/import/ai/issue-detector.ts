import { type ImportAuditIssue, type IssueDetectorConfig, DEFAULT_DETECTOR_CONFIG } from './types'

interface DataRow {
  row: number
  data: Record<string, unknown>
}

interface AmountStats {
  mean: number
  stdDev: number
  min: number
  max: number
  median: number
}

export class IssueDetector {
  private readonly config: IssueDetectorConfig

  constructor(config: Partial<IssueDetectorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config }
  }

  detectDuplicates(rows: DataRow[]): ImportAuditIssue[] {
    const issues: ImportAuditIssue[] = []
    const seen = new Map<string, number[]>()

    for (const row of rows) {
      const key = this.createRowKey(row.data)
      if (key) {
        const existing = seen.get(key)
        if (existing) {
          existing.push(row.row)
        } else {
          seen.set(key, [row.row])
        }
      }
    }

    for (const [_key, rowNumbers] of seen) {
      if (rowNumbers.length > 1) {
        const firstRow = rowNumbers[0]
        for (let i = 1; i < rowNumbers.length; i++) {
          issues.push({
            id: `dup-${rowNumbers[i]}`,
            row: rowNumbers[i],
            type: 'duplicate_entry',
            severity: 'medium',
            category: 'accuracy',
            message: `Duplicate entry detected (same as row ${firstRow})`,
            messageJa: `重複エントリが検出されました（行${firstRow}と同一）`,
            relatedRows: [firstRow],
          })
        }
      }
    }

    return issues
  }

  detectAmountAnomalies(rows: DataRow[], amountField: string = 'amount'): ImportAuditIssue[] {
    const issues: ImportAuditIssue[] = []
    const amounts: number[] = []

    for (const row of rows) {
      const amount = this.extractNumber(row.data[amountField])
      if (amount !== null && amount > 0) {
        amounts.push(amount)
      }
    }

    if (amounts.length < 3) {
      return issues
    }

    const stats = this.calculateStats(amounts)

    for (const row of rows) {
      const amount = this.extractNumber(row.data[amountField])
      if (amount === null) continue

      const zScore = stats.stdDev > 0 ? Math.abs(amount - stats.mean) / stats.stdDev : 0

      if (zScore > this.config.anomalyThreshold) {
        const severity = zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low'
        issues.push({
          id: `anomaly-${row.row}`,
          row: row.row,
          type: 'unusual_amount',
          severity,
          category: 'validity',
          message: `Unusual amount detected: ${amount} (z-score: ${zScore.toFixed(2)})`,
          messageJa: `異常な金額が検出されました: ${amount}（Zスコア: ${zScore.toFixed(2)}）`,
          field: amountField,
          value: amount,
          suggestion: `Verify this amount is correct. Average: ${stats.mean.toFixed(0)}, Median: ${stats.median.toFixed(0)}`,
          suggestionJa: `この金額が正しいか確認してください。平均: ${stats.mean.toFixed(0)}, 中央値: ${stats.median.toFixed(0)}`,
        })
      }
    }

    return issues
  }

  detectDateIssues(rows: DataRow[], dateField: string = 'entryDate'): ImportAuditIssue[] {
    const issues: ImportAuditIssue[] = []
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    const oneYearAhead = new Date(today)
    oneYearAhead.setFullYear(today.getFullYear() + 1)

    for (const row of rows) {
      const dateValue = row.data[dateField]
      if (!dateValue) {
        issues.push({
          id: `date-missing-${row.row}`,
          row: row.row,
          type: 'missing_required_field',
          severity: 'critical',
          category: 'completeness',
          message: `Missing date field`,
          messageJa: `日付フィールドが不足しています`,
          field: dateField,
        })
        continue
      }

      const date = this.parseDate(dateValue)
      if (!date) {
        issues.push({
          id: `date-invalid-${row.row}`,
          row: row.row,
          type: 'invalid_date',
          severity: 'critical',
          category: 'validity',
          message: `Invalid date format: ${dateValue}`,
          messageJa: `無効な日付形式です: ${dateValue}`,
          field: dateField,
          value: dateValue,
          suggestion: 'Use YYYY-MM-DD format',
          suggestionJa: 'YYYY-MM-DD形式を使用してください',
        })
        continue
      }

      if (date < oneYearAgo) {
        issues.push({
          id: `date-past-${row.row}`,
          row: row.row,
          type: 'period_mismatch',
          severity: 'low',
          category: 'timeliness',
          message: `Date is more than one year in the past: ${dateValue}`,
          messageJa: `日付が1年以上前です: ${dateValue}`,
          field: dateField,
          value: dateValue,
        })
      }

      if (date > oneYearAhead) {
        issues.push({
          id: `date-future-${row.row}`,
          row: row.row,
          type: 'period_mismatch',
          severity: 'medium',
          category: 'timeliness',
          message: `Date is more than one year in the future: ${dateValue}`,
          messageJa: `日付が1年以上未来です: ${dateValue}`,
          field: dateField,
          value: dateValue,
        })
      }
    }

    return issues
  }

  detectTaxIssues(
    rows: DataRow[],
    amountField: string = 'amount',
    taxField: string = 'taxAmount',
    taxTypeField: string = 'taxType'
  ): ImportAuditIssue[] {
    const issues: ImportAuditIssue[] = []

    const taxRates: Record<string, number> = {
      '課税10%': 0.1,
      '課税8%': 0.08,
      '軽減8%': 0.08,
      '課税5%': 0.05,
      免税: 0,
      不課税: 0,
      非課税: 0,
      taxable_10: 0.1,
      taxable_8: 0.08,
      reduced_8: 0.08,
      taxable_5: 0.05,
      exempt: 0,
      non_taxable: 0,
    }

    for (const row of rows) {
      const amount = this.extractNumber(row.data[amountField])
      const taxAmount = this.extractNumber(row.data[taxField])
      const taxType = String(row.data[taxTypeField] || '')

      if (amount === null || amount <= 0) continue

      const expectedRate = taxRates[taxType.toLowerCase()] ?? 0.1

      if (taxAmount !== null && taxAmount > 0 && expectedRate > 0) {
        const expectedTax = Math.round(amount * expectedRate)
        const tolerance = Math.max(1, amount * 0.001)
        const diff = Math.abs(taxAmount - expectedTax)

        if (diff > tolerance) {
          issues.push({
            id: `tax-${row.row}`,
            row: row.row,
            type: 'tax_calculation_error',
            severity: 'medium',
            category: 'accuracy',
            message: `Tax amount mismatch. Expected: ${expectedTax}, Actual: ${taxAmount}`,
            messageJa: `税額が一致しません。予想: ${expectedTax}, 実際: ${taxAmount}`,
            field: taxField,
            value: taxAmount,
            suggestion: `Verify tax calculation. Rate: ${expectedRate * 100}%`,
            suggestionJa: `税額計算を確認してください。税率: ${expectedRate * 100}%`,
          })
        }
      }
    }

    return issues
  }

  detectBalanceIssues(
    rows: DataRow[],
    debitField: string = 'debitAccount',
    creditField: string = 'creditAccount',
    amountField: string = 'amount'
  ): ImportAuditIssue[] {
    const issues: ImportAuditIssue[] = []

    for (const row of rows) {
      const debit = row.data[debitField]
      const credit = row.data[creditField]
      const amount = this.extractNumber(row.data[amountField])

      if (!debit) {
        issues.push({
          id: `debit-missing-${row.row}`,
          row: row.row,
          type: 'missing_required_field',
          severity: 'critical',
          category: 'completeness',
          message: 'Missing debit account',
          messageJa: '借方科目が不足しています',
          field: debitField,
        })
      }

      if (!credit) {
        issues.push({
          id: `credit-missing-${row.row}`,
          row: row.row,
          type: 'missing_required_field',
          severity: 'critical',
          category: 'completeness',
          message: 'Missing credit account',
          messageJa: '貸方科目が不足しています',
          field: creditField,
        })
      }

      if (debit && credit && debit === credit) {
        issues.push({
          id: `same-account-${row.row}`,
          row: row.row,
          type: 'category_inconsistency',
          severity: 'high',
          category: 'validity',
          message: `Debit and credit accounts are the same: ${debit}`,
          messageJa: `借方と貸方が同じ科目です: ${debit}`,
          field: debitField,
          value: debit,
          suggestion: 'Verify the journal entry is correct',
          suggestionJa: '仕訳が正しいか確認してください',
        })
      }

      if (amount === null || amount <= 0) {
        issues.push({
          id: `amount-invalid-${row.row}`,
          row: row.row,
          type: 'missing_required_field',
          severity: 'critical',
          category: 'completeness',
          message: 'Invalid or missing amount',
          messageJa: '金額が無効または不足しています',
          field: amountField,
          value: amount,
        })
      }
    }

    return issues
  }

  private createRowKey(data: Record<string, unknown>): string | null {
    const relevantFields = [
      'entryDate',
      'debitAccount',
      'creditAccount',
      'amount',
      'fiscalYear',
      'month',
      'accountCode',
    ]

    const keyParts: string[] = []
    for (const field of relevantFields) {
      if (data[field] !== undefined) {
        keyParts.push(`${field}:${data[field]}`)
      }
    }

    return keyParts.length > 0 ? keyParts.join('|') : null
  }

  private extractNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '').trim()
      const num = parseFloat(cleaned)
      return isNaN(num) ? null : num
    }
    return null
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null
    const str = String(value)
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/
    const match = str.match(dateRegex)
    if (!match) return null

    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)

    const date = new Date(year, month, day)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null
    }
    return date
  }

  private calculateStats(values: number[]): AmountStats {
    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    const mean = sum / sorted.length

    const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length
    const stdDev = Math.sqrt(variance)

    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

    return {
      mean,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median,
    }
  }
}

export const issueDetector = new IssueDetector()
