import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'

export function createBalanceSheet(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
  const defaults: BalanceSheet = {
    fiscalYear: 2024,
    month: 12,
    assets: {
      current: [
        { code: '1100', name: '現金預金', amount: 320000000 },
        { code: '1110', name: '定期預金', amount: 30000000 },
        { code: '1120', name: '未収入金', amount: 2000000 },
        { code: '1130', name: '前払費用', amount: 15000000 },
        { code: '1140', name: '立替金', amount: 1000000 },
      ],
      fixed: [
        {
          code: '2000',
          name: '有形固定資産',
          amount: 48000000,
          children: [
            { code: '2010', name: '建物附属設備', amount: 20000000 },
            { code: '2020', name: '機械装置', amount: 35000000 },
            { code: '2030', name: '減価償却累計額', amount: -7000000 },
          ],
        },
        {
          code: '2100',
          name: '無形固定資産',
          amount: 12000000,
          children: [
            { code: '2110', name: 'ソフトウェア', amount: 5000000 },
            { code: '2120', name: '特許権', amount: 7000000 },
          ],
        },
      ],
      total: 426000000,
    },
    liabilities: {
      current: [
        { code: '3100', name: '未払金', amount: 25000000 },
        { code: '3110', name: '未払費用', amount: 6000000 },
        { code: '3120', name: '預り金', amount: 2000000 },
        { code: '3130', name: '前受金', amount: 3000000 },
      ],
      fixed: [{ code: '4100', name: '退職給付引当金', amount: 4000000 }],
      total: 40000000,
    },
    equity: {
      items: [
        { code: '5100', name: '資本金', amount: 100000000 },
        { code: '5110', name: '資本準備金', amount: 400000000 },
        { code: '5120', name: '繰越欠損金', amount: -114000000 },
      ],
      total: 386000000,
    },
    totalAssets: 426000000,
    totalLiabilities: 40000000,
    totalEquity: 386000000,
  }

  return { ...defaults, ...overrides }
}

export function createProfitLoss(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  const defaults: ProfitLoss = {
    fiscalYear: 2024,
    month: 12,
    revenue: [],
    costOfSales: [],
    grossProfit: 0,
    grossProfitMargin: 0,
    sgaExpenses: [
      { code: '6110', name: '研究者人件費', amount: 80000000 },
      { code: '6111', name: '研究支援者人件費', amount: 15000000 },
      { code: '6120', name: 'CRO委託費', amount: 60000000 },
      { code: '6121', name: 'CDMO委託費', amount: 30000000 },
      { code: '6130', name: '試薬・消耗品費', amount: 15000000 },
      { code: '6140', name: '臨床試験費', amount: 10000000 },
      { code: '6150', name: '設備保守・検定費', amount: 5000000 },
      { code: '6200', name: '管理部門人件費', amount: 20000000 },
      { code: '6210', name: '事業所費', amount: 25000000 },
      { code: '6310', name: '特許関係費', amount: 8000000 },
      { code: '6311', name: '法務・財務費', amount: 6000000 },
      { code: '6312', name: 'コンサルティング費', amount: 4000000 },
      { code: '6400', name: 'その他経費', amount: 2500000 },
    ],
    operatingIncome: -280500000,
    operatingMargin: 0,
    nonOperatingIncome: [
      { code: '7100', name: '助成金収入', amount: 2000000 },
      { code: '7110', name: '雑収入', amount: 500000 },
    ],
    nonOperatingExpenses: [{ code: '7200', name: '支払利息', amount: 200000 }],
    ordinaryIncome: -278700000,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: -278700000,
    incomeTax: 0,
    netIncome: -278700000,
    depreciation: 7000000,
  }

  return { ...defaults, ...overrides }
}

export function createCashFlowStatement(
  overrides: Partial<CashFlowStatement> = {}
): CashFlowStatement {
  const defaults: CashFlowStatement = {
    fiscalYear: 2024,
    month: 12,
    operating: {
      items: [
        { name: '当期純損失', amount: -278700000 },
        { name: '減価償却費', amount: 7000000 },
        { name: '退職給付引当金の増加', amount: 4000000 },
        { name: '未払金の増加', amount: 25000000 },
        { name: '前払費用の減少', amount: 15000000 },
        { name: '未収入金の減少', amount: 2000000 },
      ],
      netCashFromOperating: -225700000,
    },
    investing: {
      items: [
        { name: '有形固定資産の取得', amount: -48000000 },
        { name: '無形固定資産の取得', amount: -12000000 },
      ],
      netCashFromInvesting: -60000000,
    },
    financing: {
      items: [{ name: '新株発行による収入', amount: 500000000 }],
      netCashFromFinancing: 500000000,
    },
    netChangeInCash: 214300000,
    beginningCash: 105700000,
    endingCash: 320000000,
  }

  return { ...defaults, ...overrides }
}

export function createEmptyBalanceSheet(): BalanceSheet {
  return createBalanceSheet({
    assets: { current: [], fixed: [], total: 0 },
    liabilities: { current: [], fixed: [], total: 0 },
    equity: { items: [], total: 0 },
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  })
}

export function createEmptyProfitLoss(): ProfitLoss {
  return createProfitLoss({
    revenue: [],
    costOfSales: [],
    grossProfit: 0,
    grossProfitMargin: 0,
    sgaExpenses: [],
    operatingIncome: 0,
    operatingMargin: 0,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 0,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 0,
    incomeTax: 0,
    netIncome: 0,
    depreciation: 0,
  })
}
