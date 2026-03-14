import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { sampleTherapeuticsData } from './seeds/sample-therapeutics-data'

const prisma = new PrismaClient()

function generateMonthlyBS(month: number, bs: typeof sampleTherapeuticsData.balanceSheet) {
  const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find((m) => m.month === month)
  const cashBalance = monthlyBurn?.cashBalance ?? bs.assets.currentAssets.cash

  const prepaidCRO =
    month >= 7
      ? bs.assets.currentAssets.prepaidCRO
      : Math.round(bs.assets.currentAssets.prepaidCRO * 0.5)
  const accruedCRO =
    month >= 7
      ? bs.liabilities.currentLiabilities.accruedCROExpenses
      : Math.round(bs.liabilities.currentLiabilities.accruedCROExpenses * 0.5)

  const depreciationFactor = month / 12
  const accumDepBuilding = Math.round(
    bs.assets.fixedAssets.tangible.accumulatedDepreciationBuilding * depreciationFactor
  )
  const accumDepEquipment = Math.round(
    bs.assets.fixedAssets.tangible.accumulatedDepreciationEquipment * depreciationFactor
  )
  const accumDepOffice = Math.round(
    bs.assets.fixedAssets.tangible.accumulatedDepreciationOffice * depreciationFactor
  )
  const accumAmortLeasehold = Math.round(
    bs.assets.fixedAssets.tangible.accumulatedAmortizationLeasehold * depreciationFactor
  )

  return [
    {
      month,
      category: 'current_asset',
      accountCode: '1000',
      accountName: '現金及び預金',
      amount: cashBalance,
    },
    {
      month,
      category: 'current_asset',
      accountCode: '1010',
      accountName: '制限付き現金',
      amount: bs.assets.currentAssets.restrictedCash,
    },
    {
      month,
      category: 'current_asset',
      accountCode: '1100',
      accountName: '前払費用',
      amount: bs.assets.currentAssets.prepaidExpenses,
    },
    {
      month,
      category: 'current_asset',
      accountCode: '1110',
      accountName: '前払CRO費用',
      amount: prepaidCRO,
    },
    {
      month,
      category: 'current_asset',
      accountCode: '1500',
      accountName: 'その他流動資産',
      amount: bs.assets.currentAssets.otherCurrentAssets,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2000',
      accountName: '研究用建物',
      amount: bs.assets.fixedAssets.tangible.laboratoryBuilding,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2001',
      accountName: '建物減価償却累計額',
      amount: accumDepBuilding,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2100',
      accountName: '実験設備',
      amount: bs.assets.fixedAssets.tangible.labEquipment,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2101',
      accountName: '設備減価償却累計額',
      amount: accumDepEquipment,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2200',
      accountName: '事務設備',
      amount: bs.assets.fixedAssets.tangible.officeEquipment,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2201',
      accountName: '事務設備減価償却累計額',
      amount: accumDepOffice,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2300',
      accountName: 'リース改良',
      amount: bs.assets.fixedAssets.tangible.leaseholdImprovements,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '2301',
      accountName: 'リース改良償却累計額',
      amount: accumAmortLeasehold,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '3000',
      accountName: '特許権',
      amount: bs.assets.fixedAssets.intangible.patents,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '3100',
      accountName: 'ライセンス',
      amount: bs.assets.fixedAssets.intangible.licenses,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '3200',
      accountName: 'ソフトウェア',
      amount: bs.assets.fixedAssets.intangible.software,
    },
    {
      month,
      category: 'fixed_asset',
      accountCode: '4000',
      accountName: '投資その他の資産',
      amount: bs.assets.fixedAssets.investments.deposits,
    },
    {
      month,
      category: 'current_liability',
      accountCode: '5000',
      accountName: '買掛金',
      amount: bs.liabilities.currentLiabilities.accountsPayable,
    },
    {
      month,
      category: 'current_liability',
      accountCode: '5100',
      accountName: '未払CRO費用',
      amount: accruedCRO,
    },
    {
      month,
      category: 'current_liability',
      accountCode: '5110',
      accountName: '未払給与',
      amount: bs.liabilities.currentLiabilities.accruedSalaries,
    },
    {
      month,
      category: 'current_liability',
      accountCode: '5120',
      accountName: '未払賞与',
      amount: bs.liabilities.currentLiabilities.accruedBonus,
    },
    {
      month,
      category: 'current_liability',
      accountCode: '5130',
      accountName: 'その他未払費用',
      amount: bs.liabilities.currentLiabilities.otherAccruedExpenses,
    },
    {
      month,
      category: 'fixed_liability',
      accountCode: '6000',
      accountName: '退職給付引当金',
      amount: bs.liabilities.fixedLiabilities.retirementAllowances,
    },
    {
      month,
      category: 'fixed_liability',
      accountCode: '6100',
      accountName: '研究助成金',
      amount: bs.liabilities.fixedLiabilities.researchGrants,
    },
    {
      month,
      category: 'equity',
      accountCode: '7000',
      accountName: '資本金',
      amount: bs.equity.capitalStock,
    },
    {
      month,
      category: 'equity',
      accountCode: '7100',
      accountName: '資本剰余金',
      amount: bs.equity.capitalSurplus,
    },
    {
      month,
      category: 'equity',
      accountCode: '7200',
      accountName: '繰越利益剰余金',
      amount: bs.equity.deficit,
    },
  ]
}

function generateMonthlyPL(month: number, pl: typeof sampleTherapeuticsData.profitLoss) {
  const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find((m) => m.month === month)

  const monthlyRdSpend = monthlyBurn?.rdSpend ?? Math.round(pl.expenses.rdExpenses.totalRd / 12)
  const monthlySgaSpend = monthlyBurn?.sgaSpend ?? Math.round(pl.expenses.sgaExpenses.totalSga / 12)
  const monthlyRevenue = Math.round(pl.revenue.totalRevenue / 12)

  const rdInternal = Math.round(monthlyRdSpend * 0.468)
  const rdExternal = Math.round(monthlyRdSpend * 0.532)

  const sgaPersonnel = Math.round(monthlySgaSpend * 0.45)
  const sgaProfessional = Math.round(monthlySgaSpend * 0.21)
  const sgaFacilities = Math.round(monthlySgaSpend * 0.2)
  const sgaOther = monthlySgaSpend - sgaPersonnel - sgaProfessional - sgaFacilities

  const interestIncome = Math.round(pl.nonOperating.interestIncome / 12)

  return [
    {
      month,
      category: 'revenue',
      accountCode: '4000',
      accountName: '助成金収入',
      amount: Math.round(monthlyRevenue * 0.73),
    },
    {
      month,
      category: 'revenue',
      accountCode: '4010',
      accountName: '共同研究収入',
      amount: Math.round(monthlyRevenue * 0.27),
    },
    {
      month,
      category: 'sga_expense',
      accountCode: '5000',
      accountName: '研究開発費（内部）',
      amount: rdInternal,
    },
    {
      month,
      category: 'sga_expense',
      accountCode: '5010',
      accountName: '研究開発費（外部CRO/CDMO）',
      amount: rdExternal,
    },
    {
      month,
      category: 'sga_expense',
      accountCode: '5100',
      accountName: '管理部門人件費',
      amount: sgaPersonnel,
    },
    {
      month,
      category: 'sga_expense',
      accountCode: '5110',
      accountName: '専門サービス費用',
      amount: sgaProfessional,
    },
    {
      month,
      category: 'sga_expense',
      accountCode: '5120',
      accountName: '施設費',
      amount: sgaFacilities,
    },
    {
      month,
      category: 'sga_expense',
      accountCode: '5130',
      accountName: 'その他経費',
      amount: sgaOther,
    },
    {
      month,
      category: 'non_operating_income',
      accountCode: '6000',
      accountName: '受取利息',
      amount: interestIncome,
    },
  ]
}

async function main() {
  console.log('Starting seed...')

  const company = await prisma.company.upsert({
    where: { id: 'company_1' },
    update: {
      name: sampleTherapeuticsData.company.name,
      fiscalYearStart: sampleTherapeuticsData.company.fiscalYearStart,
    },
    create: {
      id: 'company_1',
      name: sampleTherapeuticsData.company.name,
      freeeCompanyId: '12345',
      fiscalYearStart: sampleTherapeuticsData.company.fiscalYearStart,
    },
  })

  console.log('Created company:', company.name)

  const passwordHash = await bcrypt.hash('admin123', 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'システム管理者',
      role: 'ADMIN',
      companyId: company.id,
    },
  })

  console.log('Created user:', user.email)

  const fiscalYear = 2025
  const bs = sampleTherapeuticsData.balanceSheet
  const pl = sampleTherapeuticsData.profitLoss

  console.log('Seeding 12 months of financial data...')

  const allMonthlyBalances: Array<{
    month: number
    category: string
    accountCode: string
    accountName: string
    amount: number
  }> = []

  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

  for (const month of months) {
    const monthlyBS = generateMonthlyBS(month, bs)
    const monthlyPL = generateMonthlyPL(month, pl)
    allMonthlyBalances.push(...monthlyBS, ...monthlyPL)
  }

  let balanceCount = 0
  for (const balance of allMonthlyBalances) {
    await prisma.monthlyBalance.upsert({
      where: {
        companyId_fiscalYear_month_accountCode: {
          companyId: company.id,
          fiscalYear,
          month: balance.month,
          accountCode: balance.accountCode,
        },
      },
      update: { amount: balance.amount },
      create: {
        companyId: company.id,
        fiscalYear,
        month: balance.month,
        accountCode: balance.accountCode,
        accountName: balance.accountName,
        category: balance.category,
        amount: balance.amount,
      },
    })
    balanceCount++
  }
  console.log('Created monthly balances:', balanceCount)

  console.log('Seeding financial KPIs...')
  const kpis = sampleTherapeuticsData.kpis

  for (const month of months) {
    const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find((m) => m.month === month)
    const burnRate = monthlyBurn?.totalBurn ?? kpis.monthlyBurnRate.average

    const kpiData = [
      { fiscalYear, month, kpiName: 'CashRunway', value: kpis.runway.months },
      { fiscalYear, month, kpiName: 'MonthlyBurnRate', value: burnRate / 1000000 },
      {
        fiscalYear,
        month,
        kpiName: 'ExternalRdRatio',
        value: kpis.rdEfficiency.externalRdRatio * 100,
      },
      {
        fiscalYear,
        month,
        kpiName: 'InternalRdRatio',
        value: kpis.rdEfficiency.internalRdRatio * 100,
      },
      {
        fiscalYear,
        month,
        kpiName: 'RdSpendPerEmployee',
        value: kpis.rdEfficiency.rdSpendPerEmployee / 10000,
      },
      { fiscalYear, month, kpiName: 'CurrentRatio', value: kpis.liquidity.currentRatio },
      { fiscalYear, month, kpiName: 'QuickRatio', value: kpis.liquidity.quickRatio },
      { fiscalYear, month, kpiName: 'CashRatio', value: kpis.liquidity.cashRatio },
    ]

    for (const kpi of kpiData) {
      await prisma.financialKPI.upsert({
        where: {
          companyId_fiscalYear_month_kpiName_currency: {
            companyId: company.id,
            fiscalYear: kpi.fiscalYear,
            month: kpi.month,
            kpiName: kpi.kpiName,
            currency: 'JPY',
          },
        },
        update: { value: kpi.value },
        create: {
          companyId: company.id,
          fiscalYear: kpi.fiscalYear,
          month: kpi.month,
          kpiName: kpi.kpiName,
          value: kpi.value,
          currency: 'JPY',
        },
      })
    }
  }
  console.log('Created financial KPIs for 12 months')

  console.log('Seeding budgets...')
  const budgets = sampleTherapeuticsData.budgets

  for (const month of months) {
    const monthlyBudgetFactor = month >= 7 ? 1.5 : 0.8

    for (const rd of budgets.rdBudget) {
      const accountCode = rd.category.replace(/[()（）]/g, '').substring(0, 10)
      const monthlyBudget = Math.round((rd.budget / 12) * monthlyBudgetFactor)

      await prisma.budget.upsert({
        where: {
          companyId_fiscalYear_month_departmentId_accountCode: {
            companyId: company.id,
            fiscalYear,
            month,
            departmentId: 'RD',
            accountCode,
          },
        },
        update: { amount: monthlyBudget },
        create: {
          companyId: company.id,
          fiscalYear,
          month,
          departmentId: 'RD',
          accountCode,
          accountName: rd.category,
          amount: monthlyBudget,
        },
      })
    }

    for (const sga of budgets.sgaBudget) {
      const accountCode = sga.category.replace(/[()（）]/g, '').substring(0, 10)
      const monthlyBudget = Math.round(sga.budget / 12)

      await prisma.budget.upsert({
        where: {
          companyId_fiscalYear_month_departmentId_accountCode: {
            companyId: company.id,
            fiscalYear,
            month,
            departmentId: 'SGA',
            accountCode,
          },
        },
        update: { amount: monthlyBudget },
        create: {
          companyId: company.id,
          fiscalYear,
          month,
          departmentId: 'SGA',
          accountCode,
          accountName: sga.category,
          amount: monthlyBudget,
        },
      })
    }
  }
  console.log('Created budgets for 12 months')

  console.log('Seeding cash flows...')
  const cf = sampleTherapeuticsData.cashFlow

  for (const month of months) {
    const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find((m) => m.month === month)
    const operatingCF = monthlyBurn
      ? -monthlyBurn.totalBurn + Math.round(cf.operating.adjustments.totalAdjustments / 12)
      : cf.operating.netCashFromOperating / 12
    const investingCF = cf.investing.totalInvesting / 12
    const financingCF = month === 6 ? cf.financing.netCashFromFinancing : month === 7 ? 0 : 0

    const cashFlowData = [
      { category: 'OPERATING', itemName: '営業CF', amount: Math.round(operatingCF) },
      { category: 'INVESTING', itemName: '投資CF', amount: Math.round(investingCF) },
      { category: 'FINANCING', itemName: '財務CF', amount: Math.round(financingCF) },
    ]

    for (const flow of cashFlowData) {
      await prisma.cashFlow.upsert({
        where: {
          companyId_fiscalYear_month_category_itemName: {
            companyId: company.id,
            fiscalYear,
            month,
            category: flow.category,
            itemName: flow.itemName,
          },
        },
        update: { amount: flow.amount },
        create: {
          companyId: company.id,
          fiscalYear,
          month,
          category: flow.category,
          itemName: flow.itemName,
          amount: flow.amount,
        },
      })
    }
  }
  console.log('Created cash flows for 12 months')

  console.log('Seeding peer companies...')
  for (const peer of sampleTherapeuticsData.peerCompanies) {
    await prisma.peerCompany.upsert({
      where: {
        companyId_ticker: {
          companyId: company.id,
          ticker: peer.name.replace(/\s+/g, '').toUpperCase(),
        },
      },
      update: {
        name: peer.name,
        industry: 'Biotech',
        marketCap: peer.marketCap,
        revenue: 0,
        per: 0,
        pbr: 0,
        evEbitda: 0,
        psr: 0,
      },
      create: {
        companyId: company.id,
        ticker: peer.name.replace(/\s+/g, '').toUpperCase(),
        name: peer.name,
        industry: 'Biotech',
        marketCap: peer.marketCap,
        revenue: 0,
        per: 0,
        pbr: 0,
        evEbitda: 0,
        psr: 0,
        dataSource: 'manual',
      },
    })
  }
  console.log('Created peer companies:', sampleTherapeuticsData.peerCompanies.length)

  console.log('')
  console.log('=== Seed Complete ===')
  console.log('Company: Sample Therapeutics株式会社')
  console.log('Login: admin@example.com / admin123')
  console.log('Stage: Series A (Preclinical)')
  console.log('Fiscal Year:', fiscalYear)
  console.log('Months seeded:', months.length)
  console.log('Cash Runway:', kpis.runway.months, 'months')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
