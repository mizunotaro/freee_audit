import { NextRequest, NextResponse } from 'next/server'
import { calculateFinancialKPIs, getKPIBenchmarks } from '@/services/analytics/financial-kpi'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
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

    const kpis = await calculateSampleKPIs(targetCompanyId, fiscalYear, month)
    const benchmarks = getKPIBenchmarks(kpis)
    const yearlyKPIs = await calculateYearlyKPIs(targetCompanyId, fiscalYear)

    return NextResponse.json({
      kpis,
      benchmarks,
      yearlyKPIs,
    })
  } catch (error) {
    console.error('KPI API error:', error)
    return NextResponse.json({ error: 'Failed to calculate KPIs' }, { status: 500 })
  }
}

async function calculateSampleKPIs(companyId: string, fiscalYear: number, month: number) {
  const bs = generateSampleBalanceSheet(fiscalYear, month)
  const pl = generateSampleProfitLoss(fiscalYear, month)
  const cf = generateSampleCashFlow(fiscalYear, month)
  const previousPL = generateSampleProfitLoss(fiscalYear - 1, month)

  return calculateFinancialKPIs(bs, pl, cf, previousPL)
}

async function calculateYearlyKPIs(companyId: string, fiscalYear: number) {
  const yearlyKPIs = []

  for (let month = 1; month <= 12; month++) {
    const bs = generateSampleBalanceSheet(fiscalYear, month)
    const pl = generateSampleProfitLoss(fiscalYear, month)
    const cf = generateSampleCashFlow(fiscalYear, month)
    const previousPL =
      month > 1
        ? generateSampleProfitLoss(fiscalYear, month - 1)
        : generateSampleProfitLoss(fiscalYear - 1, 12)

    const kpis = calculateFinancialKPIs(bs, pl, cf, previousPL)
    yearlyKPIs.push({
      month,
      roe: kpis.profitability.roe,
      roa: kpis.profitability.roa,
      grossProfitMargin: kpis.profitability.grossProfitMargin,
      operatingMargin: kpis.profitability.operatingMargin,
      currentRatio: kpis.safety.currentRatio,
      equityRatio: kpis.safety.equityRatio,
    })
  }

  return yearlyKPIs
}

function generateSampleBalanceSheet(fiscalYear: number, month: number) {
  const baseMultiplier = 1 + (month - 1) * 0.02

  return {
    fiscalYear,
    month,
    assets: {
      current: [
        { code: '100', name: '現金及び預金', amount: Math.round(15000000 * baseMultiplier) },
        { code: '110', name: '売掛金', amount: Math.round(8000000 * baseMultiplier) },
        { code: '120', name: '棚卸資産', amount: Math.round(3000000 * baseMultiplier) },
        { code: '130', name: '前払費用', amount: Math.round(500000 * baseMultiplier) },
      ],
      fixed: [
        { code: '200', name: '建物', amount: 10000000 },
        { code: '210', name: '車両運搬具', amount: 3000000 },
        { code: '220', name: '工具器具備品', amount: 2000000 },
        { code: '230', name: 'ソフトウェア', amount: 1500000 },
      ],
      total: Math.round(43000000 * baseMultiplier),
    },
    liabilities: {
      current: [
        { code: '300', name: '買掛金', amount: Math.round(5000000 * baseMultiplier) },
        { code: '310', name: '未払金', amount: Math.round(1000000 * baseMultiplier) },
        { code: '320', name: '未払費用', amount: Math.round(800000 * baseMultiplier) },
      ],
      fixed: [{ code: '400', name: '長期借入金', amount: 5000000 }],
      total: Math.round(11800000 * baseMultiplier),
    },
    equity: {
      items: [
        { code: '500', name: '資本金', amount: 10000000 },
        { code: '510', name: '利益剰余金', amount: Math.round(21200000 * baseMultiplier) },
      ],
      total: Math.round(31200000 * baseMultiplier),
    },
    totalAssets: Math.round(43000000 * baseMultiplier),
    totalLiabilities: Math.round(11800000 * baseMultiplier),
    totalEquity: Math.round(31200000 * baseMultiplier),
  }
}

function generateSampleProfitLoss(fiscalYear: number, month: number) {
  const baseMultiplier = 1 + (month - 1) * 0.03

  const revenue = Math.round(5000000 * baseMultiplier)
  const costOfSales = Math.round(2000000 * baseMultiplier)
  const grossProfit = revenue - costOfSales

  const sga = [
    { code: '600', name: '給与手当', amount: 800000 },
    { code: '610', name: '福利厚生費', amount: 160000 },
    { code: '620', name: '旅費交通費', amount: 50000 },
    { code: '630', name: '通信費', amount: 30000 },
    { code: '640', name: '水道光熱費', amount: 40000 },
    { code: '650', name: '地代家賃', amount: 200000 },
    { code: '660', name: '広告宣伝費', amount: 100000 },
    { code: '670', name: '減価償却費', amount: 50000 },
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

function generateSampleCashFlow(fiscalYear: number, month: number) {
  return {
    fiscalYear,
    month,
    operatingActivities: {
      netIncome: 1000000,
      depreciation: 50000,
      increaseInReceivables: -100000,
      decreaseInInventory: 50000,
      increaseInPayables: 80000,
      otherNonCash: 20000,
      netCashFromOperating: 1100000,
    },
    investingActivities: {
      purchaseOfFixedAssets: -200000,
      saleOfFixedAssets: 0,
      netCashFromInvesting: -200000,
    },
    financingActivities: {
      proceedsFromBorrowing: 0,
      repaymentOfBorrowing: -50000,
      dividendPaid: 0,
      netCashFromFinancing: -50000,
    },
    netChangeInCash: 850000,
    beginningCash: 15000000,
    endingCash: 15850000,
  }
}
