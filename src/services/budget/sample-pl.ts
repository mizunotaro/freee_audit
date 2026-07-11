import type { ProfitLoss } from '@/types'

/**
 * サンプル損益（ProfitLoss）を生成する。
 *
 * 実績データ（MonthlyBalance）が未登録の場合のフォールバック用。
 * 本来は実データの trial balance から構築されるべきだが、現状の budget API 経路は
 * サンプル値で動作する（fin-design-01 提案 §4.2 参照：データ品質は PENDING HUMAN DETERMINATION）。
 * budget API ルートと managerial API ルートで共有してサンプル定義の重複を排除する。
 */
export function generateSamplePL(
  fiscalYear: number,
  month: number
): Omit<ProfitLoss, 'netIncome'> & { netIncome: number } {
  const baseMultiplier = 1 + (month - 1) * 0.03
  const revenue = Math.round(5000000 * baseMultiplier)
  const costOfSales = Math.round(2000000 * baseMultiplier)

  return {
    fiscalYear,
    month,
    revenue: [{ code: '400', name: '売上高', amount: revenue }],
    costOfSales: [{ code: '500', name: '売上原価', amount: costOfSales }],
    grossProfit: revenue - costOfSales,
    grossProfitMargin: ((revenue - costOfSales) / revenue) * 100,
    sgaExpenses: [
      { code: '600', name: '給与手当', amount: 800000 },
      { code: '610', name: '福利厚生費', amount: 160000 },
      { code: '620', name: '旅費交通費', amount: 50000 },
      { code: '630', name: '通信費', amount: 30000 },
      { code: '640', name: '水道光熱費', amount: 40000 },
      { code: '650', name: '地代家賃', amount: 200000 },
      { code: '660', name: '広告宣伝費', amount: 100000 },
      { code: '670', name: '減価償却費', amount: 50000 },
    ],
    operatingIncome: revenue - costOfSales - 1430000,
    operatingMargin: ((revenue - costOfSales - 1430000) / revenue) * 100,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: revenue - costOfSales - 1430000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: revenue - costOfSales - 1430000,
    incomeTax: Math.round((revenue - costOfSales - 1430000) * 0.3),
    netIncome: Math.round((revenue - costOfSales - 1430000) * 0.7),
    depreciation: 50000,
  }
}
