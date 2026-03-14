import { prisma } from '@/lib/db'
import { SafeFormulaEvaluator, FormulaError } from '@/lib/utils/safe-formula-evaluator'

export type CalculationType = 'FORMULA' | 'MANUAL' | 'AGGREGATE'
export type ComparisonType = 'higher_better' | 'lower_better' | 'range'

export interface CustomKPICalculation {
  kpiId: string
  name: string
  value: number
  unit: string
  format: string
  status: 'good' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
  previousValue?: number
  yoyChange?: number
}

export interface CustomKPIDetail {
  id: string
  companyId: string
  name: string
  code: string
  description: string | null
  category: string
  calculationType: CalculationType
  formula: string | null
  dataSource: string | null
  unit: string
  displayFormat: string | null
  decimalPlaces: number
  isVisible: boolean
  sortOrder: number
  targetValue: number | null
  warningThreshold: number | null
  criticalThreshold: number | null
  comparisonType: ComparisonType
}

export interface CustomKPIInput {
  name: string
  code: string
  description?: string
  category: string
  calculationType: CalculationType
  formula?: string
  dataSource?: string
  unit?: string
  displayFormat?: string
  decimalPlaces?: number
  isVisible?: boolean
  targetValue?: number
  warningThreshold?: number
  criticalThreshold?: number
  comparisonType?: ComparisonType
}

export interface CustomKPIValueInput {
  fiscalYear: number
  month: number
  value: number
  notes?: string
}

export const AVAILABLE_VARIABLES: Record<string, string> = {
  total_assets: '総資産',
  current_assets: '流動資産',
  cash: '現金預金',
  accounts_receivable: '売掛金',
  inventory: '棚卸資産',
  total_liabilities: '負債合計',
  current_liabilities: '流動負債',
  equity: '純資産',
  revenue: '売上高',
  gross_profit: '売上総利益',
  operating_income: '営業利益',
  net_income: '当期純利益',
  depreciation: '減価償却費',
  sga_expenses: '販管費',
  operating_cf: '営業CF',
  investing_cf: '投資CF',
  financing_cf: '財務CF',
  free_cash_flow: 'フリーキャッシュフロー',
  employee_count: '従業員数',
  customer_count: '顧客数',
  active_users: 'アクティブユーザー数',
  burn_rate: 'Burn Rate',
  runway: 'Runway',
  mrr: 'MRR',
  arr: 'ARR',
}

export const DEFAULT_KPIS: Omit<CustomKPIInput, 'companyId'>[] = [
  {
    name: '売上高経常利益率',
    code: 'op_margin',
    formula: 'operating_income / revenue * 100',
    category: '収益性',
    calculationType: 'FORMULA',
    unit: '%',
    displayFormat: '0.0%',
    decimalPlaces: 1,
    targetValue: 10,
    warningThreshold: 5,
    criticalThreshold: 0,
    comparisonType: 'higher_better',
    isVisible: true,
  },
  {
    name: '労働分配率',
    code: 'labor_ratio',
    formula: 'labor_cost / added_value * 100',
    category: '効率性',
    calculationType: 'FORMULA',
    unit: '%',
    displayFormat: '0.0%',
    decimalPlaces: 1,
    targetValue: 50,
    warningThreshold: 60,
    criticalThreshold: 70,
    comparisonType: 'lower_better',
    isVisible: true,
  },
  {
    name: '従業員一人当たり売上高',
    code: 'revenue_per_employee',
    formula: 'revenue / employee_count',
    category: '生産性',
    calculationType: 'FORMULA',
    unit: '円',
    displayFormat: '#,##0',
    decimalPlaces: 0,
    targetValue: 30000000,
    warningThreshold: 20000000,
    criticalThreshold: 10000000,
    comparisonType: 'higher_better',
    isVisible: true,
  },
  {
    name: '粗利率',
    code: 'gross_margin',
    formula: 'gross_profit / revenue * 100',
    category: '収益性',
    calculationType: 'FORMULA',
    unit: '%',
    displayFormat: '0.0%',
    decimalPlaces: 1,
    targetValue: 40,
    warningThreshold: 30,
    criticalThreshold: 20,
    comparisonType: 'higher_better',
    isVisible: true,
  },
  {
    name: '流動比率',
    code: 'current_ratio',
    formula: 'current_assets / current_liabilities * 100',
    category: '安全性',
    calculationType: 'FORMULA',
    unit: '%',
    displayFormat: '0.0%',
    decimalPlaces: 1,
    targetValue: 150,
    warningThreshold: 100,
    criticalThreshold: 80,
    comparisonType: 'higher_better',
    isVisible: true,
  },
  {
    name: '自己資本比率',
    code: 'equity_ratio',
    formula: 'equity / total_assets * 100',
    category: '安全性',
    calculationType: 'FORMULA',
    unit: '%',
    displayFormat: '0.0%',
    decimalPlaces: 1,
    targetValue: 40,
    warningThreshold: 25,
    criticalThreshold: 10,
    comparisonType: 'higher_better',
    isVisible: true,
  },
]

export async function getCustomKPIs(companyId: string): Promise<CustomKPIDetail[]> {
  const kpis = await prisma.customKPI.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return kpis.map((k) => ({
    id: k.id,
    companyId: k.companyId,
    name: k.name,
    code: k.code,
    description: k.description,
    category: k.category,
    calculationType: k.calculationType as CalculationType,
    formula: k.formula,
    dataSource: k.dataSource,
    unit: k.unit,
    displayFormat: k.displayFormat,
    decimalPlaces: k.decimalPlaces,
    isVisible: k.isVisible,
    sortOrder: k.sortOrder,
    targetValue: k.targetValue,
    warningThreshold: k.warningThreshold,
    criticalThreshold: k.criticalThreshold,
    comparisonType: k.comparisonType as ComparisonType,
  }))
}

export async function getVisibleCustomKPIs(companyId: string): Promise<CustomKPIDetail[]> {
  const kpis = await prisma.customKPI.findMany({
    where: { companyId, isVisible: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return kpis.map((k) => ({
    id: k.id,
    companyId: k.companyId,
    name: k.name,
    code: k.code,
    description: k.description,
    category: k.category,
    calculationType: k.calculationType as CalculationType,
    formula: k.formula,
    dataSource: k.dataSource,
    unit: k.unit,
    displayFormat: k.displayFormat,
    decimalPlaces: k.decimalPlaces,
    isVisible: k.isVisible,
    sortOrder: k.sortOrder,
    targetValue: k.targetValue,
    warningThreshold: k.warningThreshold,
    criticalThreshold: k.criticalThreshold,
    comparisonType: k.comparisonType as ComparisonType,
  }))
}

export async function getCustomKPIById(id: string): Promise<CustomKPIDetail | null> {
  const kpi = await prisma.customKPI.findUnique({
    where: { id },
  })

  if (!kpi) return null

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    code: kpi.code,
    description: kpi.description,
    category: kpi.category,
    calculationType: kpi.calculationType as CalculationType,
    formula: kpi.formula,
    dataSource: kpi.dataSource,
    unit: kpi.unit,
    displayFormat: kpi.displayFormat,
    decimalPlaces: kpi.decimalPlaces,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
    targetValue: kpi.targetValue,
    warningThreshold: kpi.warningThreshold,
    criticalThreshold: kpi.criticalThreshold,
    comparisonType: kpi.comparisonType as ComparisonType,
  }
}

export async function getCustomKPIByCode(
  companyId: string,
  code: string
): Promise<CustomKPIDetail | null> {
  const kpi = await prisma.customKPI.findUnique({
    where: {
      companyId_code: { companyId, code },
    },
  })

  if (!kpi) return null

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    code: kpi.code,
    description: kpi.description,
    category: kpi.category,
    calculationType: kpi.calculationType as CalculationType,
    formula: kpi.formula,
    dataSource: kpi.dataSource,
    unit: kpi.unit,
    displayFormat: kpi.displayFormat,
    decimalPlaces: kpi.decimalPlaces,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
    targetValue: kpi.targetValue,
    warningThreshold: kpi.warningThreshold,
    criticalThreshold: kpi.criticalThreshold,
    comparisonType: kpi.comparisonType as ComparisonType,
  }
}

export async function createCustomKPI(
  companyId: string,
  data: CustomKPIInput
): Promise<CustomKPIDetail> {
  const maxOrder = await prisma.customKPI.aggregate({
    where: { companyId },
    _max: { sortOrder: true },
  })

  const sortOrder = (maxOrder._max.sortOrder || 0) + 1

  const kpi = await prisma.customKPI.create({
    data: {
      companyId,
      name: data.name,
      code: data.code,
      description: data.description || null,
      category: data.category,
      calculationType: data.calculationType,
      formula: data.formula || null,
      dataSource: data.dataSource || null,
      unit: data.unit || 'number',
      displayFormat: data.displayFormat || null,
      decimalPlaces: data.decimalPlaces || 0,
      isVisible: data.isVisible ?? true,
      sortOrder,
      targetValue: data.targetValue || null,
      warningThreshold: data.warningThreshold || null,
      criticalThreshold: data.criticalThreshold || null,
      comparisonType: data.comparisonType || 'higher_better',
    },
  })

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    code: kpi.code,
    description: kpi.description,
    category: kpi.category,
    calculationType: kpi.calculationType as CalculationType,
    formula: kpi.formula,
    dataSource: kpi.dataSource,
    unit: kpi.unit,
    displayFormat: kpi.displayFormat,
    decimalPlaces: kpi.decimalPlaces,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
    targetValue: kpi.targetValue,
    warningThreshold: kpi.warningThreshold,
    criticalThreshold: kpi.criticalThreshold,
    comparisonType: kpi.comparisonType as ComparisonType,
  }
}

export async function updateCustomKPI(
  id: string,
  data: Partial<CustomKPIInput>
): Promise<CustomKPIDetail> {
  const kpi = await prisma.customKPI.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      description: data.description,
      category: data.category,
      calculationType: data.calculationType,
      formula: data.formula,
      dataSource: data.dataSource,
      unit: data.unit,
      displayFormat: data.displayFormat,
      decimalPlaces: data.decimalPlaces,
      isVisible: data.isVisible,
      targetValue: data.targetValue,
      warningThreshold: data.warningThreshold,
      criticalThreshold: data.criticalThreshold,
      comparisonType: data.comparisonType,
    },
  })

  return {
    id: kpi.id,
    companyId: kpi.companyId,
    name: kpi.name,
    code: kpi.code,
    description: kpi.description,
    category: kpi.category,
    calculationType: kpi.calculationType as CalculationType,
    formula: kpi.formula,
    dataSource: kpi.dataSource,
    unit: kpi.unit,
    displayFormat: kpi.displayFormat,
    decimalPlaces: kpi.decimalPlaces,
    isVisible: kpi.isVisible,
    sortOrder: kpi.sortOrder,
    targetValue: kpi.targetValue,
    warningThreshold: kpi.warningThreshold,
    criticalThreshold: kpi.criticalThreshold,
    comparisonType: kpi.comparisonType as ComparisonType,
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
        code: kpi.code,
        description: kpi.description || null,
        category: kpi.category,
        calculationType: kpi.calculationType,
        formula: kpi.formula || null,
        dataSource: kpi.dataSource || null,
        unit: kpi.unit || 'number',
        displayFormat: kpi.displayFormat || null,
        decimalPlaces: kpi.decimalPlaces || 0,
        isVisible: kpi.isVisible ?? true,
        sortOrder: order++,
        targetValue: kpi.targetValue || null,
        warningThreshold: kpi.warningThreshold || null,
        criticalThreshold: kpi.criticalThreshold || null,
        comparisonType: kpi.comparisonType || 'higher_better',
      },
    })
  }

  return DEFAULT_KPIS.length
}

export interface KPIEvaluationContext {
  total_assets: number
  current_assets: number
  cash: number
  accounts_receivable: number
  inventory: number
  total_liabilities: number
  current_liabilities: number
  equity: number
  revenue: number
  gross_profit: number
  operating_income: number
  net_income: number
  depreciation: number
  sga_expenses: number
  operating_cf: number
  investing_cf: number
  financing_cf: number
  free_cash_flow: number
  employee_count: number
  customer_count: number
  active_users: number
  burn_rate: number
  runway: number
  mrr: number
  arr: number
  labor_cost: number
  added_value: number
  fixed_assets: number
  interest_expense: number
}

export type EvaluateResult = { success: true; data: number } | { success: false; error: string }

const KPI_EVALUATOR_VARIABLES = [
  'total_assets',
  'current_assets',
  'cash',
  'accounts_receivable',
  'inventory',
  'total_liabilities',
  'current_liabilities',
  'equity',
  'revenue',
  'gross_profit',
  'operating_income',
  'net_income',
  'depreciation',
  'sga_expenses',
  'operating_cf',
  'investing_cf',
  'financing_cf',
  'free_cash_flow',
  'employee_count',
  'customer_count',
  'active_users',
  'burn_rate',
  'runway',
  'mrr',
  'arr',
  'labor_cost',
  'added_value',
  'fixed_assets',
  'interest_expense',
]

const kpiEvaluator = new SafeFormulaEvaluator(KPI_EVALUATOR_VARIABLES, {
  divisionByZeroBehavior: 'null',
})

function getDefaultContext(): Record<string, number> {
  return {
    total_assets: 0,
    current_assets: 0,
    cash: 0,
    accounts_receivable: 0,
    inventory: 0,
    total_liabilities: 0,
    current_liabilities: 0,
    equity: 0,
    revenue: 0,
    gross_profit: 0,
    operating_income: 0,
    net_income: 0,
    depreciation: 0,
    sga_expenses: 0,
    operating_cf: 0,
    investing_cf: 0,
    financing_cf: 0,
    free_cash_flow: 0,
    employee_count: 1,
    customer_count: 0,
    active_users: 0,
    burn_rate: 0,
    runway: 0,
    mrr: 0,
    arr: 0,
    labor_cost: 0,
    added_value: 0,
    fixed_assets: 0,
    interest_expense: 0,
  }
}

export function evaluateCustomFormula(
  formula: string,
  context: Partial<KPIEvaluationContext>
): number | null {
  try {
    const mergedContext = { ...getDefaultContext(), ...context } as Record<string, number>
    const result = kpiEvaluator.evaluate(formula, mergedContext)

    if (result === null) return null
    return Math.round(result * 100) / 100
  } catch {
    return null
  }
}

export function evaluateCustomFormulaWithResult(
  formula: string,
  context: Partial<KPIEvaluationContext>
): EvaluateResult {
  try {
    const mergedContext = { ...getDefaultContext(), ...context } as Record<string, number>
    const result = kpiEvaluator.evaluate(formula, mergedContext)

    if (result === null) {
      return { success: false, error: '計算結果が無効です（ゼロ除算など）' }
    }
    return { success: true, data: Math.round(result * 100) / 100 }
  } catch (error) {
    if (error instanceof FormulaError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '数式の評価中にエラーが発生しました' }
  }
}

function translateError(error: string): string {
  if (error.includes('Unknown variable or function:')) {
    const varName = error.replace('Unknown variable or function: ', '')
    return `不明な変数: ${varName}`
  }
  if (error.includes('dangerous pattern')) {
    return '安全でないコードが含まれています'
  }
  if (error.includes('Syntax error:')) {
    const syntaxError = error.replace('Syntax error: ', '')
    return `構文エラー: ${syntaxError}`
  }
  if (error.includes('Function not allowed:')) {
    const funcName = error.replace('Function not allowed: ', '')
    return `使用できない関数: ${funcName}`
  }
  return error
}

export function validateFormula(formula: string): { valid: boolean; error?: string } {
  const validation = kpiEvaluator.validate(formula)

  if (!validation.isValid) {
    const error = validation.errors[0] || '数式が無効です'
    return { valid: false, error: translateError(error) }
  }

  return { valid: true }
}

export function evaluateKPIStatus(
  value: number,
  kpi: CustomKPIDetail
): 'good' | 'warning' | 'critical' {
  const { targetValue, warningThreshold, criticalThreshold, comparisonType } = kpi

  if (targetValue === null && warningThreshold === null && criticalThreshold === null) {
    return 'good'
  }

  if (comparisonType === 'higher_better') {
    if (criticalThreshold !== null && value < criticalThreshold) return 'critical'
    if (warningThreshold !== null && value < warningThreshold) return 'warning'
    return 'good'
  } else if (comparisonType === 'lower_better') {
    if (criticalThreshold !== null && value > criticalThreshold) return 'critical'
    if (warningThreshold !== null && value > warningThreshold) return 'warning'
    return 'good'
  } else {
    if (criticalThreshold !== null && warningThreshold !== null) {
      if (value < criticalThreshold || value > warningThreshold) return 'critical'
    }
    return 'good'
  }
}

export function evaluateTrend(
  currentValue: number,
  previousValue: number | null | undefined
): 'up' | 'down' | 'stable' {
  if (previousValue === null || previousValue === undefined) return 'stable'

  const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100
  if (change > 5) return 'up'
  if (change < -5) return 'down'
  return 'stable'
}

export async function setKPIValue(
  customKPIId: string,
  fiscalYear: number,
  month: number,
  value: number,
  notes?: string
): Promise<void> {
  const existing = await prisma.customKPIValue.findUnique({
    where: {
      customKPIId_fiscalYear_month: {
        customKPIId,
        fiscalYear,
        month,
      },
    },
  })

  let previousValue: number | null = null
  if (existing) {
    previousValue = existing.value
  } else {
    const prevValue = await prisma.customKPIValue.findFirst({
      where: {
        customKPIId,
        OR: [{ fiscalYear, month: { lt: month } }, { fiscalYear: { lt: fiscalYear } }],
      },
      orderBy: [{ fiscalYear: 'desc' }, { month: 'desc' }],
    })
    if (prevValue) {
      previousValue = prevValue.value
    }
  }

  const yoyChange =
    previousValue !== null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : null

  await prisma.customKPIValue.upsert({
    where: {
      customKPIId_fiscalYear_month: {
        customKPIId,
        fiscalYear,
        month,
      },
    },
    update: {
      value,
      previousValue,
      yoyChange,
      notes,
      isCalculated: false,
    },
    create: {
      customKPIId,
      fiscalYear,
      month,
      value,
      previousValue,
      yoyChange,
      notes,
      isCalculated: false,
    },
  })
}

export async function getKPIValue(
  customKPIId: string,
  fiscalYear: number,
  month: number
): Promise<{ value: number; previousValue: number | null; yoyChange: number | null } | null> {
  const kpiValue = await prisma.customKPIValue.findUnique({
    where: {
      customKPIId_fiscalYear_month: {
        customKPIId,
        fiscalYear,
        month,
      },
    },
  })

  if (!kpiValue) return null

  return {
    value: kpiValue.value,
    previousValue: kpiValue.previousValue,
    yoyChange: kpiValue.yoyChange,
  }
}

export async function getKPIValues(
  customKPIId: string,
  fiscalYear: number
): Promise<
  Array<{ month: number; value: number; previousValue: number | null; yoyChange: number | null }>
> {
  const values = await prisma.customKPIValue.findMany({
    where: {
      customKPIId,
      fiscalYear,
    },
    orderBy: { month: 'asc' },
  })

  return values.map((v) => ({
    month: v.month,
    value: v.value,
    previousValue: v.previousValue,
    yoyChange: v.yoyChange,
  }))
}

export async function calculateAndSaveKPI(
  customKPIId: string,
  fiscalYear: number,
  month: number,
  context: Partial<KPIEvaluationContext>
): Promise<number | null> {
  const kpi = await prisma.customKPI.findUnique({
    where: { id: customKPIId },
  })

  if (!kpi || kpi.calculationType !== 'FORMULA' || !kpi.formula) {
    return null
  }

  const value = evaluateCustomFormula(kpi.formula, context)
  if (value === null) return null

  const existing = await prisma.customKPIValue.findUnique({
    where: {
      customKPIId_fiscalYear_month: {
        customKPIId,
        fiscalYear,
        month,
      },
    },
  })

  let previousValue: number | null = null
  if (existing) {
    previousValue = existing.value
  } else {
    const prevValue = await prisma.customKPIValue.findFirst({
      where: {
        customKPIId,
        OR: [{ fiscalYear, month: { lt: month } }, { fiscalYear: { lt: fiscalYear } }],
      },
      orderBy: [{ fiscalYear: 'desc' }, { month: 'desc' }],
    })
    if (prevValue) {
      previousValue = prevValue.value
    }
  }

  const yoyChange =
    previousValue !== null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : null

  await prisma.customKPIValue.upsert({
    where: {
      customKPIId_fiscalYear_month: {
        customKPIId,
        fiscalYear,
        month,
      },
    },
    update: {
      value,
      previousValue,
      yoyChange,
      isCalculated: true,
    },
    create: {
      customKPIId,
      fiscalYear,
      month,
      value,
      previousValue,
      yoyChange,
      isCalculated: true,
    },
  })

  return value
}

export async function calculateAllFormulaKPIs(
  companyId: string,
  fiscalYear: number,
  month: number,
  context: Partial<KPIEvaluationContext>
): Promise<CustomKPICalculation[]> {
  const kpis = await prisma.customKPI.findMany({
    where: {
      companyId,
      calculationType: 'FORMULA',
      isVisible: true,
    },
  })

  const results: CustomKPICalculation[] = []

  for (const kpi of kpis) {
    if (!kpi.formula) continue

    const value = await calculateAndSaveKPI(kpi.id, fiscalYear, month, context)
    if (value === null) continue

    const kpiValue = await getKPIValue(kpi.id, fiscalYear, month)

    const kpiDetail: CustomKPIDetail = {
      id: kpi.id,
      companyId: kpi.companyId,
      name: kpi.name,
      code: kpi.code,
      description: kpi.description,
      category: kpi.category,
      calculationType: kpi.calculationType as CalculationType,
      formula: kpi.formula,
      dataSource: kpi.dataSource,
      unit: kpi.unit,
      displayFormat: kpi.displayFormat,
      decimalPlaces: kpi.decimalPlaces,
      isVisible: kpi.isVisible,
      sortOrder: kpi.sortOrder,
      targetValue: kpi.targetValue,
      warningThreshold: kpi.warningThreshold,
      criticalThreshold: kpi.criticalThreshold,
      comparisonType: kpi.comparisonType as ComparisonType,
    }

    results.push({
      kpiId: kpi.id,
      name: kpi.name,
      value,
      unit: kpi.unit,
      format: kpi.displayFormat || '',
      status: evaluateKPIStatus(value, kpiDetail),
      trend: evaluateTrend(value, kpiValue?.previousValue),
      previousValue: kpiValue?.previousValue ?? undefined,
      yoyChange: kpiValue?.yoyChange ?? undefined,
    })
  }

  return results
}
