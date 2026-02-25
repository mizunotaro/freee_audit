import { NextRequest, NextResponse } from 'next/server'
import { calculateCashFlow } from '@/services/cashflow/calculator'
import {
  generateCashPosition,
  generateDetailedCashPosition,
} from '@/services/cashflow/cash-position'
import {
  calculateRunway,
  getRunwayAlert,
  calculateBurnRateTrend,
} from '@/services/cashflow/runway-calculator'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const companyId = searchParams.get('companyId')

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

    const cashFlows = await getYearCashFlows(targetCompanyId, fiscalYear)
    const cashPosition = generateCashPosition(cashFlows, 15000000)
    const detailedPosition = generateDetailedCashPosition(cashFlows, 15000000)

    const currentCash = cashPosition.months[cashPosition.months.length - 1]?.endingCash || 15000000
    const runway = calculateRunway(currentCash, cashFlows)
    const alert = getRunwayAlert(runway.runwayMonths)
    const trend = calculateBurnRateTrend(cashFlows)

    return NextResponse.json({
      cashFlows,
      cashPosition,
      detailedPosition,
      runway,
      alert,
      trend,
    })
  } catch (error) {
    console.error('Cashflow report error:', error)
    return NextResponse.json({ error: 'Failed to generate cashflow report' }, { status: 500 })
  }
}

async function getYearCashFlows(companyId: string, fiscalYear: number) {
  const cashFlows = []

  for (let month = 1; month <= 12; month++) {
    const bs = await getBalanceSheet(companyId, fiscalYear, month)
    const previousBS = month > 1 ? await getBalanceSheet(companyId, fiscalYear, month - 1) : null
    const pl = await getProfitLoss(companyId, fiscalYear, month)

    cashFlows.push(calculateCashFlow(pl, bs, previousBS))
  }

  return cashFlows
}

async function getBalanceSheet(companyId: string, fiscalYear: number, month: number) {
  const baseMultiplier = 1 + (month - 1) * 0.02

  return {
    fiscalYear,
    month,
    assets: {
      current: [
        { code: '100', name: '現金及び預金', amount: Math.round(15000000 * baseMultiplier) },
        { code: '110', name: '売掛金', amount: Math.round(8000000 * baseMultiplier) },
        { code: '120', name: '棚卸資産', amount: Math.round(3000000 * baseMultiplier) },
      ],
      fixed: [
        { code: '200', name: '建物', amount: 10000000 },
        { code: '210', name: '車両運搬具', amount: 3000000 },
      ],
      total: Math.round(39000000 * baseMultiplier),
    },
    liabilities: {
      current: [
        { code: '300', name: '買掛金', amount: Math.round(5000000 * baseMultiplier) },
        { code: '310', name: '未払金', amount: Math.round(1000000 * baseMultiplier) },
      ],
      fixed: [{ code: '400', name: '長期借入金', amount: 5000000 }],
      total: Math.round(11000000 * baseMultiplier),
    },
    equity: {
      items: [
        { code: '500', name: '資本金', amount: 10000000 },
        { code: '510', name: '利益剰余金', amount: Math.round(18000000 * baseMultiplier) },
      ],
      total: Math.round(28000000 * baseMultiplier),
    },
    totalAssets: Math.round(39000000 * baseMultiplier),
    totalLiabilities: Math.round(11000000 * baseMultiplier),
    totalEquity: Math.round(28000000 * baseMultiplier),
  }
}

async function getProfitLoss(companyId: string, fiscalYear: number, month: number) {
  const baseMultiplier = 1 + (month - 1) * 0.03
  const revenue = Math.round(5000000 * baseMultiplier)
  const costOfSales = Math.round(2000000 * baseMultiplier)
  const grossProfit = revenue - costOfSales

  const sga = [
    { code: '600', name: '給与手当', amount: 800000 },
    { code: '610', name: '福利厚生費', amount: 160000 },
    { code: '620', name: '地代家賃', amount: 200000 },
    { code: '630', name: '減価償却費', amount: 50000 },
  ]

  const totalSga = sga.reduce((sum, e) => sum + e.amount, 0)
  const operatingIncome = grossProfit - totalSga

  return {
    fiscalYear,
    month,
    revenue: [{ code: '400', name: '売上高', amount: revenue }],
    costOfSales: [{ code: '500', name: '売上原価', amount: costOfSales }],
    grossProfit,
    grossProfitMargin: (grossProfit / revenue) * 100,
    sgaExpenses: sga,
    operatingIncome,
    operatingMargin: (operatingIncome / revenue) * 100,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: operatingIncome,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: operatingIncome,
    incomeTax: Math.round(operatingIncome * 0.3),
    netIncome: Math.round(operatingIncome * 0.7),
    depreciation: 50000,
  }
}
