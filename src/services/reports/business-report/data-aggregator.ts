import { prisma } from '@/lib/db'
import type {
  AggregatedReportData,
  CompanyInfo,
  FinancialData,
  BusinessReportShareholderData,
  OfficerData,
  BoardMeetingData,
  JournalData,
  FixedAssetData,
  RelatedPartyData,
  CalculatedMetrics,
  MonthlyBalanceData,
} from '@/types/reports/business'

export class BusinessReportDataAggregator {
  async aggregate(companyId: string, fiscalYear: number): Promise<AggregatedReportData> {
    const [
      companyInfo,
      financialData,
      shareholders,
      officers,
      boardMeetings,
      journals,
      fixedAssets,
      relatedParties,
    ] = await Promise.all([
      this.getCompanyInfo(companyId),
      this.getFinancialData(companyId, fiscalYear),
      this.getShareholderData(companyId),
      this.getOfficerData(companyId),
      this.getBoardMeetingData(companyId, fiscalYear),
      this.getJournalData(companyId, fiscalYear),
      this.getFixedAssetData(companyId),
      this.getRelatedPartyData(companyId),
    ])

    const calculatedMetrics = this.calculateMetrics(financialData)

    return {
      companyInfo,
      financialData,
      shareholders,
      officers,
      boardMeetings,
      journals,
      fixedAssets,
      relatedParties,
      calculatedMetrics,
    }
  }

  private async getCompanyInfo(companyId: string): Promise<CompanyInfo> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      throw new Error(`Company not found: ${companyId}`)
    }

    return {
      id: company.id,
      name: company.name,
      fiscalYearStart: company.fiscalYearStart,
    }
  }

  private async getFinancialData(companyId: string, fiscalYear: number): Promise<FinancialData> {
    const currentYearBalances = await prisma.monthlyBalance.findMany({
      where: {
        companyId,
        fiscalYear,
      },
    })

    const previousYearBalances = await prisma.monthlyBalance.findMany({
      where: {
        companyId,
        fiscalYear: fiscalYear - 1,
      },
    })

    const currentYearTotals = this.aggregateByAccount(currentYearBalances)
    const previousYearTotals = this.aggregateByAccount(previousYearBalances)

    const monthlyBalances: MonthlyBalanceData[] = currentYearBalances.map((b) => ({
      month: b.month,
      fiscalYear: b.fiscalYear,
      category: b.category,
      accountName: b.accountName,
      amount: b.amount,
    }))

    return {
      monthlyBalances,
      currentYearTotals,
      previousYearTotals,
    }
  }

  private aggregateByAccount(
    balances: Array<{ accountName: string; amount: number }>
  ): Record<string, number> {
    return balances.reduce(
      (acc, b) => {
        acc[b.accountName] = (acc[b.accountName] || 0) + b.amount
        return acc
      },
      {} as Record<string, number>
    )
  }

  private async getShareholderData(companyId: string): Promise<BusinessReportShareholderData> {
    const compositions = await prisma.shareholderComposition.findMany({
      where: { companyId },
      orderBy: { percentage: 'desc' },
    })

    const totalShares = compositions.reduce((sum, c) => sum + c.sharesHeld, 0)

    return {
      totalShares,
      shareholderComposition: compositions.map((c) => ({
        type: c.shareholderType,
        numberOfShares: c.sharesHeld,
        percentage: c.percentage,
      })),
    }
  }

  private async getOfficerData(companyId: string): Promise<OfficerData> {
    const users = await prisma.user.findMany({
      where: {
        companyId,
        role: { in: ['ADMIN', 'MANAGER'] },
      },
    })

    const directors = users
      .filter((u) => u.role === 'ADMIN')
      .map((u) => ({
        id: u.id,
        name: u.name,
        position: '取締役',
        independent: false,
      }))

    const auditors = users
      .filter((u) => u.role === 'MANAGER')
      .map((u) => ({
        id: u.id,
        name: u.name,
        position: '監査役',
        independent: false,
      }))

    return { directors, auditors }
  }

  private async getBoardMeetingData(
    companyId: string,
    fiscalYear: number
  ): Promise<BoardMeetingData[]> {
    const startDate = new Date(fiscalYear, 0, 1)
    const endDate = new Date(fiscalYear, 11, 31)

    const meetings = await prisma.boardMeeting.findMany({
      where: {
        companyId,
        meetingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        meetingDate: 'asc',
      },
    })

    return meetings.map((m) => ({
      id: m.id,
      date: m.meetingDate,
      title: m.meetingType,
      attendees: [],
      minutes: m.minutes || undefined,
    }))
  }

  private async getJournalData(companyId: string, fiscalYear: number): Promise<JournalData> {
    const startDate = new Date(fiscalYear, 0, 1)
    const endDate = new Date(fiscalYear, 11, 31)

    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        entryDate: 'asc',
      },
      take: 1000,
    })

    const entries = journals.map((j) => ({
      id: j.id,
      entryDate: j.entryDate,
      description: j.description,
      debitAccount: j.debitAccount,
      creditAccount: j.creditAccount,
      amount: j.amount,
    }))

    const totals = entries.reduce(
      (acc, e) => {
        acc[e.debitAccount] = (acc[e.debitAccount] || 0) + e.amount
        return acc
      },
      {} as Record<string, number>
    )

    return { entries, totals }
  }

  private async getFixedAssetData(companyId: string): Promise<FixedAssetData[]> {
    const assets = await prisma.fixedAsset.findMany({
      where: { companyId },
    })

    return assets.map((a) => ({
      id: a.id,
      name: a.name,
      acquisitionCost: a.acquisitionCost,
      accumulatedDep: a.accumulatedDep,
      bookValue: a.bookValue,
      usefulLife: a.usefulLife,
    }))
  }

  private async getRelatedPartyData(_companyId: string): Promise<RelatedPartyData[]> {
    return []
  }

  private calculateMetrics(financialData: FinancialData): CalculatedMetrics {
    const current = financialData.currentYearTotals
    const previous = financialData.previousYearTotals

    const currentRevenue = current['売上高'] || current['売上高計'] || 0
    const previousRevenue = previous['売上高'] || previous['売上高計'] || 0

    const revenueGrowth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0

    const operatingIncome = current['営業利益'] || 0
    const operatingMargin = currentRevenue > 0 ? (operatingIncome / currentRevenue) * 100 : 0

    const netIncome = current['当期純利益'] || 0
    const netMargin = currentRevenue > 0 ? (netIncome / currentRevenue) * 100 : 0

    const totalAssets = current['資産合計'] || current['資産の部合計'] || 0
    const netAssets = current['純資産合計'] || current['純資産の部合計'] || 0

    const roe = netAssets > 0 ? (netIncome / netAssets) * 100 : 0
    const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0

    const currentAssets = current['流動資産合計'] || current['流動資産'] || 0
    const currentLiabilities = current['流動負債合計'] || current['流動負債'] || 0
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0

    const totalLiabilities = current['負債合計'] || current['負債の部合計'] || 0
    const debtToEquity = netAssets > 0 ? totalLiabilities / netAssets : 0

    return {
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      operatingMargin: Math.round(operatingMargin * 100) / 100,
      netMargin: Math.round(netMargin * 100) / 100,
      roe: Math.round(roe * 100) / 100,
      roa: Math.round(roa * 100) / 100,
      currentRatio: Math.round(currentRatio * 100) / 100,
      debtToEquity: Math.round(debtToEquity * 100) / 100,
    }
  }

  validateData(data: AggregatedReportData): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.companyInfo.name) {
      errors.push('会社名が設定されていません')
    }

    if (data.financialData.monthlyBalances.length === 0) {
      warnings.push('財務データが登録されていません')
    }

    if (data.officers.directors.length === 0) {
      warnings.push('取締役情報が登録されていません')
    }

    if (data.shareholders.shareholderComposition.length === 0) {
      warnings.push('株主構成データが登録されていません')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }
}

export const businessReportDataAggregator = new BusinessReportDataAggregator()
