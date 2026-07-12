import { describe, it, expect } from 'vitest'
import {
  calculateOperatingCF,
  calculateInvestingCF,
  calculateFinancingCF,
  calculateCashFlowStatement,
  calculateGrossProfit,
  calculateOperatingIncome,
  calculateNetIncome,
  aggregateByCategory,
  calculateYoYGrowth,
  calculateMoMGrowth,
  type CashFlowInputs,
} from '@/services/report/cash-flow'
import type { ProfitLossItem } from '@/types'

const createInputs = (overrides: Partial<CashFlowInputs> = {}): CashFlowInputs => ({
  netIncome: 1000,
  depreciation: 100,
  amortization: 50,
  accountsReceivableChange: 200,
  inventoryChange: 100,
  accountsPayableChange: 150,
  otherOperatingAdjustments: 75,
  fixedAssetPurchases: 300,
  fixedAssetSales: 80,
  borrowingProceeds: 500,
  borrowingRepayments: 200,
  dividendsPaid: 50,
  beginningCash: 1000,
  ...overrides,
})

describe('calculateOperatingCF', () => {
  it('sums net income, non-cash items and working-capital changes on the happy path', () => {
    const inputs = createInputs()
    // 1000 + 100 + 50 - 200 - 100 + 150 + 75 = 1075
    expect(calculateOperatingCF(inputs)).toBe(1075)
  })

  it('treats an all-zero input as zero operating cash flow', () => {
    const inputs = createInputs({
      netIncome: 0,
      depreciation: 0,
      amortization: 0,
      accountsReceivableChange: 0,
      inventoryChange: 0,
      accountsPayableChange: 0,
      otherOperatingAdjustments: 0,
    })
    expect(calculateOperatingCF(inputs)).toBe(0)
  })

  it('reduces cash when receivables and inventory grow', () => {
    const inputs = createInputs({
      netIncome: 500,
      depreciation: 0,
      amortization: 0,
      accountsReceivableChange: 300,
      inventoryChange: 200,
      accountsPayableChange: 0,
      otherOperatingAdjustments: 0,
    })
    // 500 - 300 - 200 = 0
    expect(calculateOperatingCF(inputs)).toBe(0)
  })

  it('preserves sign for a net loss', () => {
    const inputs = createInputs({
      netIncome: -4000,
      depreciation: 1000,
      amortization: 0,
      accountsReceivableChange: 0,
      inventoryChange: 0,
      accountsPayableChange: 0,
      otherOperatingAdjustments: 0,
    })
    expect(calculateOperatingCF(inputs)).toBe(-3000)
  })

  it('stays finite for very large amounts', () => {
    const big = Number.MAX_SAFE_INTEGER / 10
    const inputs = createInputs({
      netIncome: big,
      depreciation: big,
      amortization: big,
      accountsReceivableChange: big,
      inventoryChange: big,
      accountsPayableChange: big,
      otherOperatingAdjustments: big,
    })
    const result = calculateOperatingCF(inputs)
    expect(Number.isFinite(result)).toBe(true)
  })
})

describe('calculateInvestingCF', () => {
  it('returns sale proceeds less purchases on the happy path', () => {
    // -300 + 80 = -220
    expect(calculateInvestingCF(createInputs())).toBe(-220)
  })

  it('is zero when nothing is bought or sold', () => {
    const inputs = createInputs({ fixedAssetPurchases: 0, fixedAssetSales: 0 })
    expect(calculateInvestingCF(inputs)).toBe(0)
  })

  it('is positive when sales exceed purchases', () => {
    const inputs = createInputs({ fixedAssetPurchases: 100, fixedAssetSales: 400 })
    expect(calculateInvestingCF(inputs)).toBe(300)
  })

  it('stays finite for very large amounts', () => {
    const big = Number.MAX_SAFE_INTEGER / 10
    const inputs = createInputs({ fixedAssetPurchases: big, fixedAssetSales: big })
    expect(Number.isFinite(calculateInvestingCF(inputs))).toBe(true)
  })
})

describe('calculateFinancingCF', () => {
  it('returns proceeds less repayments and dividends on the happy path', () => {
    // 500 - 200 - 50 = 250
    expect(calculateFinancingCF(createInputs())).toBe(250)
  })

  it('is zero when there is no financing activity', () => {
    const inputs = createInputs({
      borrowingProceeds: 0,
      borrowingRepayments: 0,
      dividendsPaid: 0,
    })
    expect(calculateFinancingCF(inputs)).toBe(0)
  })

  it('is negative when repayments and dividends exceed proceeds', () => {
    const inputs = createInputs({
      borrowingProceeds: 100,
      borrowingRepayments: 300,
      dividendsPaid: 200,
    })
    // 100 - 300 - 200 = -400
    expect(calculateFinancingCF(inputs)).toBe(-400)
  })
})

describe('calculateCashFlowStatement', () => {
  it('builds a full statement with categorized line items and net change', () => {
    const inputs = createInputs()
    const stmt = calculateCashFlowStatement(inputs)

    expect(stmt.operating).toBeDefined()
    expect(stmt.investing).toBeDefined()
    expect(stmt.financing).toBeDefined()

    expect(stmt.operating!.items).toEqual([
      { name: '当期純利益', amount: 1000 },
      { name: '減価償却費', amount: 100 },
      { name: 'のれん償却', amount: 50 },
      { name: '売掛金の増減', amount: -200 },
      { name: '棚卸資産の増減', amount: -100 },
      { name: '買掛金の増減', amount: 150 },
      { name: 'その他', amount: 75 },
    ])
    expect(stmt.operating!.netCashFromOperating).toBe(1075)

    expect(stmt.investing!.items).toEqual([
      { name: '固定資産の取得', amount: -300 },
      { name: '固定資産の売却', amount: 80 },
    ])
    expect(stmt.investing!.netCashFromInvesting).toBe(-220)

    expect(stmt.financing!.items).toEqual([
      { name: '借入金の増加', amount: 500 },
      { name: '借入金の返済', amount: -200 },
      { name: '配当金の支払', amount: -50 },
    ])
    expect(stmt.financing!.netCashFromFinancing).toBe(250)

    // 1075 - 220 + 250 = 1105
    expect(stmt.netChangeInCash).toBe(1105)
    expect(stmt.beginningCash).toBe(1000)
    expect(stmt.endingCash).toBe(2105)
  })

  it('keeps net change equal to the sum of the three sub-totals', () => {
    const stmt = calculateCashFlowStatement(createInputs())
    expect(stmt.netChangeInCash).toBe(
      stmt.operating!.netCashFromOperating +
        stmt.investing!.netCashFromInvesting +
        stmt.financing!.netCashFromFinancing
    )
  })

  it('keeps ending cash equal to beginning cash plus net change', () => {
    const stmt = calculateCashFlowStatement(createInputs({ beginningCash: 4242 }))
    expect(stmt.endingCash).toBe(stmt.beginningCash + stmt.netChangeInCash)
  })

  it('keeps each section net equal to the sum of its line items', () => {
    const stmt = calculateCashFlowStatement(createInputs())
    expect(stmt.operating!.netCashFromOperating).toBe(
      stmt.operating!.items.reduce((sum, i) => sum + i.amount, 0)
    )
    expect(stmt.investing!.netCashFromInvesting).toBe(
      stmt.investing!.items.reduce((sum, i) => sum + i.amount, 0)
    )
    expect(stmt.financing!.netCashFromFinancing).toBe(
      stmt.financing!.items.reduce((sum, i) => sum + i.amount, 0)
    )
  })

  it('sets period start and end as Date instances', () => {
    const stmt = calculateCashFlowStatement(createInputs())
    expect(stmt.periodStart).toBeInstanceOf(Date)
    expect(stmt.periodEnd).toBeInstanceOf(Date)
  })

  it('degrades to zero net change for an all-zero input', () => {
    const inputs = createInputs({
      netIncome: 0,
      depreciation: 0,
      amortization: 0,
      accountsReceivableChange: 0,
      inventoryChange: 0,
      accountsPayableChange: 0,
      otherOperatingAdjustments: 0,
      fixedAssetPurchases: 0,
      fixedAssetSales: 0,
      borrowingProceeds: 0,
      borrowingRepayments: 0,
      dividendsPaid: 0,
      beginningCash: 0,
    })
    const stmt = calculateCashFlowStatement(inputs)
    expect(stmt.netChangeInCash).toBe(0)
    expect(stmt.beginningCash).toBe(0)
    expect(stmt.endingCash).toBe(0)
  })

  it('keeps ending cash above beginning cash when net change is positive', () => {
    const inputs = createInputs({
      fixedAssetPurchases: 0,
      borrowingRepayments: 0,
      dividendsPaid: 0,
    })
    const stmt = calculateCashFlowStatement(inputs)
    expect(stmt.netChangeInCash).toBeGreaterThan(0)
    expect(stmt.endingCash).toBeGreaterThan(stmt.beginningCash)
  })

  it('is deterministic: identical inputs yield identical sub-totals', () => {
    const a = calculateCashFlowStatement(createInputs())
    const b = calculateCashFlowStatement(createInputs())
    expect(a.operating!.netCashFromOperating).toBe(b.operating!.netCashFromOperating)
    expect(a.netChangeInCash).toBe(b.netChangeInCash)
    expect(a.endingCash).toBe(b.endingCash)
  })
})

describe('calculateGrossProfit', () => {
  it('subtracts cost of sales from revenue', () => {
    expect(calculateGrossProfit(1000, 600)).toBe(400)
  })

  it('is zero when revenue equals cost of sales', () => {
    expect(calculateGrossProfit(500, 500)).toBe(0)
  })

  it('is negative when cost of sales exceeds revenue', () => {
    expect(calculateGrossProfit(300, 800)).toBe(-500)
  })

  it('returns revenue unchanged when cost of sales is zero', () => {
    expect(calculateGrossProfit(750, 0)).toBe(750)
  })
})

describe('calculateOperatingIncome', () => {
  it('subtracts operating expenses from gross profit', () => {
    expect(calculateOperatingIncome(400, 250)).toBe(150)
  })

  it('is zero when gross profit equals operating expenses', () => {
    expect(calculateOperatingIncome(300, 300)).toBe(0)
  })

  it('is negative (operating loss) when expenses exceed gross profit', () => {
    expect(calculateOperatingIncome(200, 500)).toBe(-300)
  })
})

describe('calculateNetIncome', () => {
  it('adds non-operating income and subtracts expenses and tax', () => {
    // 150 + 30 - 20 - 40 = 120
    expect(calculateNetIncome(150, 30, 20, 40)).toBe(120)
  })

  it('is zero for all-zero inputs', () => {
    expect(calculateNetIncome(0, 0, 0, 0)).toBe(0)
  })

  it('becomes a net loss when tax and expenses exceed income', () => {
    // 100 + 0 - 50 - 200 = -150
    expect(calculateNetIncome(100, 0, 50, 200)).toBe(-150)
  })

  it('equals operating income when there is no non-operating activity or tax', () => {
    expect(calculateNetIncome(250, 0, 0, 0)).toBe(250)
  })
})

describe('aggregateByCategory', () => {
  const item = (code: string, amount: number, category?: string): ProfitLossItem => ({
    code,
    name: code,
    amount,
    category,
  })

  it('groups and sums amounts by category', () => {
    const items = [
      item('A1', 100, 'revenue'),
      item('A2', 200, 'revenue'),
      item('B1', 50, 'cogs'),
      item('B2', -30, 'cogs'),
    ]
    const result = aggregateByCategory(items)
    expect(result.get('revenue')).toBe(300)
    expect(result.get('cogs')).toBe(20)
    expect(result.size).toBe(2)
  })

  it('places items without a category under the default bucket', () => {
    const items = [item('A1', 100), item('A2', 25, undefined)]
    const result = aggregateByCategory(items)
    expect(result.get('default')).toBe(125)
    expect(result.size).toBe(1)
  })

  it('returns an empty map for an empty input array', () => {
    const result = aggregateByCategory([])
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('handles negative amounts and accumulates them correctly', () => {
    const items = [item('A1', -100, 'expense'), item('A2', -50, 'expense')]
    const result = aggregateByCategory(items)
    expect(result.get('expense')).toBe(-150)
  })

  it('keeps each distinct category separate', () => {
    const items = [item('A1', 10, 'alpha'), item('A2', 20, 'beta'), item('A3', 30, 'gamma')]
    const result = aggregateByCategory(items)
    expect(result.get('alpha')).toBe(10)
    expect(result.get('beta')).toBe(20)
    expect(result.get('gamma')).toBe(30)
    expect(result.size).toBe(3)
  })
})

describe('calculateYoYGrowth', () => {
  it('computes positive growth as a percentage', () => {
    // ((150 - 100) / 100) * 100 = 50
    expect(calculateYoYGrowth(150, 100)).toBe(50)
  })

  it('computes negative growth (decline) as a percentage', () => {
    // ((80 - 100) / 100) * 100 = -20
    expect(calculateYoYGrowth(80, 100)).toBe(-20)
  })

  it('returns 100 when previous is zero and current is positive', () => {
    expect(calculateYoYGrowth(100, 0)).toBe(100)
  })

  it('returns 0 when previous is zero and current is zero', () => {
    expect(calculateYoYGrowth(0, 0)).toBe(0)
  })

  it('returns 0 when previous is zero and current is negative', () => {
    expect(calculateYoYGrowth(-50, 0)).toBe(0)
  })

  it('uses the absolute value of a negative previous period', () => {
    // ((50 - (-100)) / 100) * 100 = 150
    expect(calculateYoYGrowth(50, -100)).toBe(150)
  })

  it('returns 0 when current equals previous', () => {
    expect(calculateYoYGrowth(250, 250)).toBe(0)
  })
})

describe('calculateMoMGrowth', () => {
  it('computes positive growth as a percentage', () => {
    expect(calculateMoMGrowth(120, 100)).toBe(20)
  })

  it('computes negative growth (decline) as a percentage', () => {
    expect(calculateMoMGrowth(90, 100)).toBe(-10)
  })

  it('returns 100 when previous is zero and current is positive', () => {
    expect(calculateMoMGrowth(10, 0)).toBe(100)
  })

  it('returns 0 when previous is zero and current is zero or negative', () => {
    expect(calculateMoMGrowth(0, 0)).toBe(0)
    expect(calculateMoMGrowth(-5, 0)).toBe(0)
  })

  it('uses the absolute value of a negative previous period', () => {
    // ((0 - (-50)) / 50) * 100 = 100
    expect(calculateMoMGrowth(0, -50)).toBe(100)
  })
})
