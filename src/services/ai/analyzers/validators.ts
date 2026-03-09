import type { BalanceSheet, ProfitLoss } from '@/types'
import type { FinancialStatementSet, AnalysisOptions, AnalyzerResult } from './types'

export function validateBalanceSheet(bs: BalanceSheet): AnalyzerResult<BalanceSheet> {
  const errors: string[] = []

  if (bs.totalAssets !== bs.totalLiabilities + bs.totalEquity) {
    const diff = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity))
    if (diff > 1) {
      errors.push(`貸借対照表のバランスが一致しません（差額: ${diff.toLocaleString()}円）`)
    }
  }

  if (bs.totalAssets < 0) {
    errors.push('資産合計が負の値です')
  }

  if (bs.totalEquity < 0) {
    errors.push('純資産合計が負の値です')
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        code: 'invalid_balance_sheet',
        message: errors.join('; '),
      },
    }
  }

  return { success: true, data: bs }
}

export function validateProfitLoss(pl: ProfitLoss): AnalyzerResult<ProfitLoss> {
  const errors: string[] = []

  const totalRevenue = pl.revenue.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  if (totalRevenue < 0) {
    errors.push('売上高が負の値です')
  }

  if (pl.netIncome === undefined || pl.netIncome === null) {
    errors.push('当期純利益が設定されていません')
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        code: 'invalid_profit_loss',
        message: errors.join('; '),
      },
    }
  }

  return { success: true, data: pl }
}

export function validateFinancialStatementSet(
  statements: FinancialStatementSet
): AnalyzerResult<FinancialStatementSet> {
  const errors: string[] = []

  if (!statements.balanceSheet) {
    errors.push('貸借対照表が必要です')
  }

  if (!statements.profitLoss) {
    errors.push('損益計算書が必要です')
  }

  if (statements.balanceSheet && statements.profitLoss) {
    if (statements.balanceSheet.fiscalYear !== statements.profitLoss.fiscalYear) {
      errors.push('貸借対照表と損益計算書の会計年度が一致しません')
    }
  }

  if (statements.previousBalanceSheet && statements.balanceSheet) {
    if (statements.previousBalanceSheet.fiscalYear >= statements.balanceSheet.fiscalYear) {
      errors.push('前期貸借対照表の会計年度が当期以降です')
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        code: 'invalid_statement_set',
        message: errors.join('; '),
      },
    }
  }

  return { success: true, data: statements }
}

export function validateAnalysisOptions(options: AnalysisOptions): AnalyzerResult<AnalysisOptions> {
  const validCategories = [
    'liquidity',
    'safety',
    'profitability',
    'efficiency',
    'growth',
    'cashflow',
    'comprehensive',
  ]
  const validDepths = ['brief', 'standard', 'detailed', 'comprehensive']
  const validLanguages = ['ja', 'en']

  if (options.category && !validCategories.includes(options.category)) {
    return {
      success: false,
      error: {
        code: 'invalid_category',
        message: `Invalid category: ${options.category}. Valid options: ${validCategories.join(', ')}`,
      },
    }
  }

  if (options.depth && !validDepths.includes(options.depth)) {
    return {
      success: false,
      error: {
        code: 'invalid_depth',
        message: `Invalid depth: ${options.depth}. Valid options: ${validDepths.join(', ')}`,
      },
    }
  }

  if (options.language && !validLanguages.includes(options.language)) {
    return {
      success: false,
      error: {
        code: 'invalid_language',
        message: `Invalid language: ${options.language}. Valid options: ${validLanguages.join(', ')}`,
      },
    }
  }

  return { success: true, data: options }
}

export function sanitizeNumericValue(value: unknown): number {
  if (typeof value === 'number' && isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[,，]/g, ''))
    return isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function normalizeStatements(statements: FinancialStatementSet): FinancialStatementSet {
  return {
    ...statements,
    balanceSheet: {
      ...statements.balanceSheet,
      totalAssets: sanitizeNumericValue(statements.balanceSheet.totalAssets),
      totalLiabilities: sanitizeNumericValue(statements.balanceSheet.totalLiabilities),
      totalEquity: sanitizeNumericValue(statements.balanceSheet.totalEquity),
    },
    profitLoss: {
      ...statements.profitLoss,
      grossProfit: sanitizeNumericValue(statements.profitLoss.grossProfit),
      operatingIncome: sanitizeNumericValue(statements.profitLoss.operatingIncome),
      netIncome: sanitizeNumericValue(statements.profitLoss.netIncome),
      depreciation: sanitizeNumericValue(statements.profitLoss.depreciation),
    },
  }
}
