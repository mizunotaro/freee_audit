import { prisma } from '@/lib/db'

export interface CustomKPI {
  id: string
  companyId: string
  name: string
  formula: string
  category: string
  unit: string
  targetValue: number | null
  isVisible: boolean
  sortOrder: number
}

export interface CustomKPIInput {
  name: string
  formula: string
  category: string
  unit: string
  targetValue?: number
  isVisible?: boolean
}

export const DEFAULT_KPIS: Omit<CustomKPIInput, 'companyId'>[] = [
  {
    name: '売上高経常利益率',
    formula: 'ordinaryIncome / revenue * 100',
    category: '収益性',
    unit: '%',
    targetValue: 10,
    isVisible: true,
  },
  {
    name: '労働分配率',
    formula: 'laborCost / addedValue * 100',
    category: '効率性',
    unit: '%',
    targetValue: 50,
    isVisible: true,
  },
  {
    name: '付加価値率',
    formula: 'addedValue / revenue * 100',
    category: '生産性',
    unit: '%',
    targetValue: 40,
    isVisible: true,
  },
  {
    name: '資本生産性',
    formula: 'addedValue / totalAssets * 100',
    category: '生産性',
    unit: '%',
    targetValue: 20,
    isVisible: true,
  },
  {
    name: '従業員一人当たり売上高',
    formula: 'revenue / employeeCount',
    category: '生産性',
    unit: '円',
    targetValue: 30000000,
    isVisible: true,
  },
  {
    name: '従業員一人当たり付加価値',
    formula: 'addedValue / employeeCount',
    category: '生産性',
    unit: '円',
    targetValue: 10000000,
    isVisible: true,
  },
  {
    name: '固定長期適合率',
    formula: 'fixedAssets / (equity + fixedLiabilities) * 100',
    category: '安全性',
    unit: '%',
    targetValue: 100,
    isVisible: true,
  },
  {
    name: 'インタレスト・カバレッジ',
    formula: 'ebit / interestExpense',
    category: '安全性',
    unit: '倍',
    targetValue: 3,
    isVisible: true,
  },
]

export async function getCustomKPIs(companyId: string): Promise<CustomKPI[]> {
  const kpis = await prisma.customKPI.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return kpis.map((k) => ({
    id: k.id,
    companyId: k.companyId,
    name: k.name,
    formula: k.formula,
    category: k.category,
    unit: k.unit,
    targetValue: k.targetValue,
    isVisible: k.isVisible,
    sortOrder: k.sortOrder,
  }))
}

export async function getVisibleCustomKPIs(companyId: string): Promise<CustomKPI[]> {
  const kpis = await prisma.customKPI.findMany({
    where: { companyId, isVisible: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return kpis.map((k) => ({
    id: k.id,
    companyId: k.companyId,
    name: k.name,
    formula: k.formula,
    category: k.category,
    unit: k.unit,
    targetValue: k.targetValue,
    isVisible: k.isVisible,
    sortOrder: k.sortOrder,
  }))
}

export async function getCustomKPIById(id: string): Promise<CustomKPI | null> {
  const kpi = await prisma.customKPI.findUnique({
    where: { id },
  })

  if (!kpi) return null

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    formula: kpi.formula,
    category: kpi.category,
    unit: kpi.unit,
    targetValue: kpi.targetValue,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
  }
}

export async function createCustomKPI(companyId: string, data: CustomKPIInput): Promise<CustomKPI> {
  const maxOrder = await prisma.customKPI.aggregate({
    where: { companyId },
    _max: { sortOrder: true },
  })

  const sortOrder = (maxOrder._max.sortOrder || 0) + 1

  const kpi = await prisma.customKPI.create({
    data: {
      companyId,
      name: data.name,
      formula: data.formula,
      category: data.category,
      unit: data.unit,
      targetValue: data.targetValue || null,
      isVisible: data.isVisible ?? true,
      sortOrder,
    },
  })

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    formula: kpi.formula,
    category: kpi.category,
    unit: kpi.unit,
    targetValue: kpi.targetValue,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
  }
}

export async function updateCustomKPI(
  id: string,
  data: Partial<CustomKPIInput>
): Promise<CustomKPI> {
  const kpi = await prisma.customKPI.update({
    where: { id },
    data: {
      name: data.name,
      formula: data.formula,
      category: data.category,
      unit: data.unit,
      targetValue: data.targetValue,
      isVisible: data.isVisible,
    },
  })

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    formula: kpi.formula,
    category: kpi.category,
    unit: kpi.unit,
    targetValue: kpi.targetValue,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
  }
}

export async function deleteCustomKPI(id: string): Promise<void> {
  await prisma.customKPI.delete({
    where: { id },
  })
}

export async function updateKPIVisibility(id: string, isVisible: boolean): Promise<void> {
  await prisma.customKPI.update({
    where: { id },
    data: { isVisible },
  })
}

export async function updateKPIOrder(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.customKPI.update({
        where: { id: u.id },
        data: { sortOrder: u.sortOrder },
      })
    )
  )
}

export async function initializeDefaultKPIs(companyId: string): Promise<number> {
  const existing = await prisma.customKPI.count({
    where: { companyId },
  })

  if (existing > 0) {
    return 0
  }

  let order = 1
  for (const kpi of DEFAULT_KPIS) {
    await prisma.customKPI.create({
      data: {
        companyId,
        name: kpi.name,
        formula: kpi.formula,
        category: kpi.category,
        unit: kpi.unit,
        targetValue: kpi.targetValue || null,
        isVisible: kpi.isVisible ?? true,
        sortOrder: order++,
      },
    })
  }

  return DEFAULT_KPIS.length
}

export interface KPIEvaluationContext {
  revenue: number
  grossProfit: number
  operatingIncome: number
  ordinaryIncome: number
  netIncome: number
  ebit: number
  ebitda: number
  totalAssets: number
  currentAssets: number
  fixedAssets: number
  totalLiabilities: number
  currentLiabilities: number
  fixedLiabilities: number
  equity: number
  interestExpense: number
  depreciation: number
  laborCost: number
  addedValue: number
  employeeCount: number
  inventory: number
  receivables: number
  payables: number
}

export function evaluateCustomFormula(
  formula: string,
  context: KPIEvaluationContext
): number | null {
  try {
    const keys = Object.keys(context)
    const values = Object.values(context)

    const safeContext: Record<string, number> = {}
    for (const key of keys) {
      const value = context[key as keyof KPIEvaluationContext]
      safeContext[key] = value ?? 0
    }

    const fn = new Function(
      ...keys,
      `try { 
        const result = ${formula};
        if (typeof result !== 'number' || !isFinite(result)) return null;
        return result;
      } catch { return null; }`
    )

    const result = fn(...values)
    return typeof result === 'number' ? Math.round(result * 100) / 100 : null
  } catch {
    return null
  }
}

export function validateFormula(formula: string): { valid: boolean; error?: string } {
  const allowedVariables = [
    'revenue',
    'grossProfit',
    'operatingIncome',
    'ordinaryIncome',
    'netIncome',
    'ebit',
    'ebitda',
    'totalAssets',
    'currentAssets',
    'fixedAssets',
    'totalLiabilities',
    'currentLiabilities',
    'fixedLiabilities',
    'equity',
    'interestExpense',
    'depreciation',
    'laborCost',
    'addedValue',
    'employeeCount',
    'inventory',
    'receivables',
    'payables',
  ]

  const varPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g
  const matches = formula.match(varPattern) || []

  for (const match of matches) {
    if (!allowedVariables.includes(match) && !Math.hasOwnProperty(match)) {
      return { valid: false, error: `不明な変数: ${match}` }
    }
  }

  const dangerousPatterns = [
    /eval/,
    /Function/,
    /window/,
    /document/,
    /import/,
    /require/,
    /process/,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(formula)) {
      return { valid: false, error: '安全でないコードが含まれています' }
    }
  }

  try {
    const testContext: KPIEvaluationContext = {
      revenue: 100,
      grossProfit: 50,
      operatingIncome: 20,
      ordinaryIncome: 18,
      netIncome: 12,
      ebit: 20,
      ebitda: 25,
      totalAssets: 200,
      currentAssets: 100,
      fixedAssets: 100,
      totalLiabilities: 100,
      currentLiabilities: 60,
      fixedLiabilities: 40,
      equity: 100,
      interestExpense: 5,
      depreciation: 5,
      laborCost: 30,
      addedValue: 60,
      employeeCount: 10,
      inventory: 20,
      receivables: 30,
      payables: 25,
    }
    evaluateCustomFormula(formula, testContext)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: `数式エラー: ${e instanceof Error ? e.message : '不明'}` }
  }
}
