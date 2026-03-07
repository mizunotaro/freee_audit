import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetsByFiscalYear,
} from '@/services/budget/budget-service'
import {
  importBudgetFromCsv,
  generateBudgetTemplate,
  validateBudgetCsv,
} from '@/services/budget/budget-import'
import {
  calculateActualVsBudget,
  analyzeBudgetVariance,
  getMonthlyBudgetTrend,
} from '@/services/budget/actual-vs-budget'
import { calculateDetailedActualVsBudget } from '@/services/budget/detailed-actual-vs-budget'
import type { ProfitLoss } from '@/types'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

function generateSamplePL(
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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const targetCompanyId = user.companyId

    switch (action) {
      case 'template': {
        const template = generateBudgetTemplate()
        return new NextResponse(template, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=budget_template.csv',
          },
        })
      }

      case 'variance': {
        if (!month) {
          return NextResponse.json(
            { error: 'Month is required for variance analysis' },
            { status: 400 }
          )
        }
        const budgetVsActual = await calculateActualVsBudgetWithSample(
          targetCompanyId,
          fiscalYear,
          month
        )
        const variance = analyzeBudgetVariance(budgetVsActual)
        return NextResponse.json({ budgetVsActual, variance })
      }

      case 'detailed': {
        if (!month) {
          return NextResponse.json(
            { error: 'Month is required for detailed analysis' },
            { status: 400 }
          )
        }
        const samplePL = generateSamplePL(fiscalYear, month)
        const detailed = await calculateDetailedActualVsBudget(
          targetCompanyId,
          fiscalYear,
          month,
          samplePL as ProfitLoss
        )
        return NextResponse.json(detailed)
      }

      case 'trend': {
        const trends = await getMonthlyBudgetTrendWithSample(targetCompanyId, fiscalYear)
        return NextResponse.json({ trends })
      }

      case 'yearly': {
        const yearlyBudgets = await getBudgetsByFiscalYear(targetCompanyId, fiscalYear)
        return NextResponse.json({ budgets: yearlyBudgets })
      }

      default: {
        const budgets = await getBudgets({
          companyId: targetCompanyId,
          fiscalYear,
          month,
        })
        return NextResponse.json({ budgets })
      }
    }
  } catch (error) {
    console.error('Budget API error:', error)
    return NextResponse.json({ error: 'Failed to process budget request' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'create': {
        const budget = await createBudget({ ...data, companyId: user.companyId })
        return NextResponse.json({ budget })
      }

      case 'import': {
        const fiscalYear = data.fiscalYear
        const csvContent = data.csvContent
        const departmentId = data.departmentId

        const validation = validateBudgetCsv(csvContent)
        if (!validation.valid) {
          return NextResponse.json(
            {
              success: false,
              errors: validation.errors,
            },
            { status: 400 }
          )
        }

        const result = await importBudgetFromCsv(
          csvContent,
          user.companyId,
          fiscalYear,
          departmentId
        )
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Budget POST error:', error)
    return NextResponse.json({ error: 'Failed to process budget request' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 })
    }

    await deleteBudget(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Budget DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, amount, departmentId, note } = body

    if (!id) {
      return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 })
    }

    const updateData: { amount?: number; departmentId?: string | null; note?: string } = {}
    if (amount !== undefined) updateData.amount = amount
    if (departmentId !== undefined) updateData.departmentId = departmentId
    if (note !== undefined) updateData.note = note

    const budget = await updateBudget(id, updateData)
    return NextResponse.json({ budget })
  } catch (error) {
    console.error('Budget PUT error:', error)
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })
  }
}

async function calculateActualVsBudgetWithSample(
  companyId: string,
  fiscalYear: number,
  month: number
) {
  const baseMultiplier = 1 + (month - 1) * 0.03
  const revenue = Math.round(5000000 * baseMultiplier)
  const costOfSales = Math.round(2000000 * baseMultiplier)

  const samplePL = {
    fiscalYear,
    month,
    revenue: [{ code: '400', name: '売上高', amount: revenue }],
    costOfSales: [{ code: '500', name: '売上原価', amount: costOfSales }],
    grossProfit: revenue - costOfSales,
    grossProfitMargin: 60,
    sgaExpenses: [
      { code: '600', name: '給与手当', amount: 800000 },
      { code: '610', name: '福利厚生費', amount: 160000 },
      { code: '620', name: '地代家賃', amount: 200000 },
    ],
    operatingIncome: revenue - costOfSales - 1160000,
    operatingMargin: 20,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 0,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 0,
    incomeTax: 0,
    netIncome: 0,
    depreciation: 50000,
  }

  return calculateActualVsBudget(companyId, fiscalYear, month, samplePL as ProfitLoss)
}

async function getMonthlyBudgetTrendWithSample(companyId: string, fiscalYear: number) {
  const monthlyActuals = new Map()

  for (let month = 1; month <= 12; month++) {
    const baseMultiplier = 1 + (month - 1) * 0.03
    const revenue = Math.round(5000000 * baseMultiplier)
    const costOfSales = Math.round(2000000 * baseMultiplier)

    monthlyActuals.set(month, {
      fiscalYear,
      month,
      revenue: [{ code: '400', name: '売上高', amount: revenue }],
      costOfSales: [{ code: '500', name: '売上原価', amount: costOfSales }],
      grossProfit: revenue - costOfSales,
      grossProfitMargin: 60,
      sgaExpenses: [
        { code: '600', name: '給与手当', amount: 800000 },
        { code: '610', name: '福利厚生費', amount: 160000 },
        { code: '620', name: '地代家賃', amount: 200000 },
      ],
      operatingIncome: revenue - costOfSales - 1160000,
      operatingMargin: 20,
      nonOperatingIncome: [],
      nonOperatingExpenses: [],
      ordinaryIncome: 0,
      extraordinaryIncome: [],
      extraordinaryLoss: [],
      incomeBeforeTax: 0,
      incomeTax: 0,
      netIncome: Math.round((revenue - costOfSales - 1160000) * 0.7),
      depreciation: 50000,
    })
  }

  return getMonthlyBudgetTrend(companyId, fiscalYear, monthlyActuals)
}
