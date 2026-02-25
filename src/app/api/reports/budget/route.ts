import { NextRequest, NextResponse } from 'next/server'
import {
  getBudgets,
  createBudget,
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
import { prisma } from '@/lib/db'
import type { ProfitLoss } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const companyId = searchParams.get('companyId')
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

    let targetCompanyId = companyId

    if (!targetCompanyId) {
      const companies = await prisma.company.findMany({ take: 1 })
      if (companies.length === 0) {
        const company = await prisma.company.create({
          data: { name: 'サンプル株式会社', fiscalYearStart: 4 },
        })
        targetCompanyId = company.id
      } else {
        targetCompanyId = companies[0].id
      }
    }

    switch (action) {
      case 'template':
        const template = generateBudgetTemplate()
        return new NextResponse(template, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=budget_template.csv',
          },
        })

      case 'variance':
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

      case 'trend':
        const trends = await getMonthlyBudgetTrendWithSample(targetCompanyId, fiscalYear)
        return NextResponse.json({ trends })

      case 'yearly':
        const yearlyBudgets = await getBudgetsByFiscalYear(targetCompanyId, fiscalYear)
        return NextResponse.json({ budgets: yearlyBudgets })

      default:
        const budgets = await getBudgets({
          companyId: targetCompanyId,
          fiscalYear,
          month,
        })
        return NextResponse.json({ budgets })
    }
  } catch (error) {
    console.error('Budget API error:', error)
    return NextResponse.json({ error: 'Failed to process budget request' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'create':
        const budget = await createBudget(data)
        return NextResponse.json({ budget })

      case 'import':
        const companyId = data.companyId
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

        const result = await importBudgetFromCsv(csvContent, companyId, fiscalYear, departmentId)
        return NextResponse.json(result)

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
