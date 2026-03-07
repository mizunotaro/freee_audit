import { prisma } from '@/lib/db'
import type {
  JournalConversion,
  ConvertedJournalLine,
  ConvertedBalanceSheet,
  ConvertedProfitLoss,
  ConvertedCashFlow,
  AccountCategory,
} from '@/types/conversion'

export interface ComparisonItem {
  sourceName: string
  targetName: string
  sourceAmount: number
  targetAmount: number
  difference: number
  differencePercent: number
}

export interface SignificantDifference {
  item: string
  sourceAmount: number
  targetAmount: number
  difference: number
  differencePercent: number
  reason: string
}

export interface ComparisonReport {
  balanceSheet: {
    items: ComparisonItem[]
    totalDifference: number
  }
  profitLoss: {
    items: ComparisonItem[]
    netIncomeDifference: number
  }
  significantDifferences: SignificantDifference[]
}

interface BalanceSheetItem {
  code: string
  name: string
  nameEn: string
  amount: number
  sourceAccountCode?: string
  category: AccountCategory
}

interface ProfitLossItem {
  code: string
  name: string
  nameEn: string
  amount: number
  sourceAccountCode?: string
  category: AccountCategory
}

interface CashFlowItem {
  code: string
  name: string
  nameEn: string
  amount: number
  sourceAccountCode?: string
  section: 'operating' | 'investing' | 'financing'
}

interface TargetAccountInfo {
  id: string
  code: string
  name: string
  nameEn: string
  category: AccountCategory
}

export class FinancialStatementConverter {
  async convertBalanceSheet(
    companyId: string,
    fiscalYear: number,
    month: number,
    journalConversions: JournalConversion[],
    targetCoaId: string
  ): Promise<ConvertedBalanceSheet> {
    const targetAccounts = await this.fetchTargetAccounts(targetCoaId)
    const accountMap = this.buildAccountCategoryMap(targetAccounts)

    const aggregated = this.aggregateByTargetAccount(journalConversions)

    const assets: BalanceSheetItem[] = []
    const liabilities: BalanceSheetItem[] = []
    const equity: BalanceSheetItem[] = []

    for (const [accountCode, data] of aggregated) {
      const accountInfo = accountMap.get(accountCode)
      if (!accountInfo) continue

      const item: BalanceSheetItem = {
        code: accountCode,
        name: accountInfo.name,
        nameEn: accountInfo.nameEn,
        amount: data.netAmount,
        sourceAccountCode: data.sourceAccounts.join(', '),
        category: accountInfo.category,
      }

      switch (accountInfo.category) {
        case 'current_asset':
        case 'fixed_asset':
        case 'deferred_asset':
          assets.push(item)
          break
        case 'current_liability':
        case 'fixed_liability':
        case 'deferred_liability':
          liabilities.push(item)
          break
        case 'equity':
          equity.push(item)
          break
      }
    }

    const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0)
    const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0)
    const totalEquity = equity.reduce((sum, item) => sum + item.amount, 0)

    const asOfDate = new Date(fiscalYear, month - 1, 1)
    asOfDate.setMonth(asOfDate.getMonth() + 1)
    asOfDate.setDate(0)

    return {
      asOfDate,
      assets: assets.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      liabilities: liabilities.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      equity: equity.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      totalAssets,
      totalLiabilities,
      totalEquity,
    }
  }

  async convertProfitLoss(
    companyId: string,
    fiscalYear: number,
    month: number,
    journalConversions: JournalConversion[]
  ): Promise<ConvertedProfitLoss> {
    const aggregated = this.aggregateByTargetAccount(journalConversions)

    const revenue: ProfitLossItem[] = []
    const costOfSales: ProfitLossItem[] = []
    const sgaExpenses: ProfitLossItem[] = []
    const nonOperatingIncome: ProfitLossItem[] = []
    const nonOperatingExpenses: ProfitLossItem[] = []

    for (const [accountCode, data] of aggregated) {
      const item: ProfitLossItem = {
        code: accountCode,
        name: data.targetName || accountCode,
        nameEn: data.targetNameEn || accountCode,
        amount: data.netAmount,
        sourceAccountCode: data.sourceAccounts.join(', '),
        category: data.category,
      }

      switch (data.category) {
        case 'revenue':
          revenue.push(item)
          break
        case 'cogs':
          costOfSales.push(item)
          break
        case 'sga_expense':
          sgaExpenses.push(item)
          break
        case 'non_operating_income':
          nonOperatingIncome.push(item)
          break
        case 'non_operating_expense':
          nonOperatingExpenses.push(item)
          break
      }
    }

    const totalRevenue = revenue.reduce((sum, item) => sum + item.amount, 0)
    const totalCostOfSales = costOfSales.reduce((sum, item) => sum + item.amount, 0)
    const totalSga = sgaExpenses.reduce((sum, item) => sum + item.amount, 0)
    const totalNonOperatingIncome = nonOperatingIncome.reduce((sum, item) => sum + item.amount, 0)
    const totalNonOperatingExpenses = nonOperatingExpenses.reduce(
      (sum, item) => sum + item.amount,
      0
    )

    const grossProfit = totalRevenue - totalCostOfSales
    const operatingIncome = grossProfit - totalSga
    const ordinaryIncome = operatingIncome + totalNonOperatingIncome - totalNonOperatingExpenses
    const netIncome = ordinaryIncome

    const periodStart = new Date(fiscalYear, month - 1, 1)
    const periodEnd = new Date(fiscalYear, month, 0)

    return {
      periodStart,
      periodEnd,
      revenue: revenue.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      costOfSales: costOfSales.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      sgaExpenses: sgaExpenses.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      nonOperatingIncome: nonOperatingIncome.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      nonOperatingExpenses: nonOperatingExpenses.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      grossProfit,
      operatingIncome,
      ordinaryIncome,
      incomeBeforeTax: netIncome,
      netIncome,
    }
  }

  async convertCashFlow(
    companyId: string,
    fiscalYear: number,
    journalConversions: JournalConversion[]
  ): Promise<ConvertedCashFlow> {
    const aggregated = this.aggregateByTargetAccount(journalConversions)

    const operatingActivities: CashFlowItem[] = []
    const investingActivities: CashFlowItem[] = []
    const financingActivities: CashFlowItem[] = []

    const cashFlowMappings = await this.getCashFlowMappings(companyId, fiscalYear)

    for (const [accountCode, data] of aggregated) {
      const cfMapping = cashFlowMappings.get(accountCode)
      if (!cfMapping) continue

      const item: CashFlowItem = {
        code: accountCode,
        name: data.targetName || accountCode,
        nameEn: data.targetNameEn || accountCode,
        amount: data.netAmount,
        sourceAccountCode: data.sourceAccounts.join(', '),
        section: cfMapping.section,
      }

      switch (cfMapping.section) {
        case 'operating':
          operatingActivities.push(item)
          break
        case 'investing':
          investingActivities.push(item)
          break
        case 'financing':
          financingActivities.push(item)
          break
      }
    }

    const netCashFromOperating = operatingActivities.reduce((sum, item) => sum + item.amount, 0)
    const netCashFromInvesting = investingActivities.reduce((sum, item) => sum + item.amount, 0)
    const netCashFromFinancing = financingActivities.reduce((sum, item) => sum + item.amount, 0)
    const netChangeInCash = netCashFromOperating + netCashFromInvesting + netCashFromFinancing

    const periodStart = new Date(fiscalYear, 0, 1)
    const periodEnd = new Date(fiscalYear, 11, 31)

    return {
      periodStart,
      periodEnd,
      operatingActivities: operatingActivities.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      investingActivities: investingActivities.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      financingActivities: financingActivities.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        amount: item.amount,
        sourceAccountCode: item.sourceAccountCode,
      })),
      netCashFromOperating,
      netCashFromInvesting,
      netCashFromFinancing,
      netChangeInCash,
    }
  }

  async generateComparisonReport(
    sourceBS: ConvertedBalanceSheet,
    targetBS: ConvertedBalanceSheet,
    sourcePL: ConvertedProfitLoss,
    targetPL: ConvertedProfitLoss
  ): Promise<ComparisonReport> {
    const bsItems = this.compareBalanceSheets(sourceBS, targetBS)
    const plItems = this.compareProfitLoss(sourcePL, targetPL)

    const significantDifferences = this.identifySignificantDifferences(bsItems, plItems)

    return {
      balanceSheet: {
        items: bsItems,
        totalDifference: targetBS.totalAssets - sourceBS.totalAssets,
      },
      profitLoss: {
        items: plItems,
        netIncomeDifference: targetPL.netIncome - sourcePL.netIncome,
      },
      significantDifferences,
    }
  }

  private async fetchTargetAccounts(targetCoaId: string): Promise<TargetAccountInfo[]> {
    const items = await prisma.chartOfAccountItem.findMany({
      where: {
        coaId: targetCoaId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        category: true,
      },
    })

    return items.map(
      (item: { id: string; code: string; name: string; nameEn: string; category: string }) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category as AccountCategory,
      })
    )
  }

  private buildAccountCategoryMap(accounts: TargetAccountInfo[]): Map<string, TargetAccountInfo> {
    const map = new Map<string, TargetAccountInfo>()
    for (const account of accounts) {
      map.set(account.code, account)
    }
    return map
  }

  private aggregateByTargetAccount(journalConversions: JournalConversion[]): Map<
    string,
    {
      netAmount: number
      sourceAccounts: string[]
      targetName: string
      targetNameEn: string
      category: AccountCategory
    }
  > {
    const aggregated = new Map<
      string,
      {
        netAmount: number
        sourceAccounts: Set<string>
        targetName: string
        targetNameEn: string
        category: AccountCategory
      }
    >()

    for (const conversion of journalConversions) {
      for (const line of conversion.lines) {
        const existing = aggregated.get(line.targetAccountCode)

        const debitContribution = line.debitAmount
        const creditContribution = -line.creditAmount
        const netContribution = debitContribution + creditContribution

        if (existing) {
          existing.netAmount += netContribution
          existing.sourceAccounts.add(line.sourceAccountCode)
        } else {
          aggregated.set(line.targetAccountCode, {
            netAmount: netContribution,
            sourceAccounts: new Set([line.sourceAccountCode]),
            targetName: line.targetAccountName,
            targetNameEn: line.targetAccountName,
            category: this.inferCategoryFromCode(line.targetAccountCode),
          })
        }
      }
    }

    const result = new Map<
      string,
      {
        netAmount: number
        sourceAccounts: string[]
        targetName: string
        targetNameEn: string
        category: AccountCategory
      }
    >()

    for (const [code, data] of aggregated) {
      result.set(code, {
        netAmount: data.netAmount,
        sourceAccounts: Array.from(data.sourceAccounts),
        targetName: data.targetName,
        targetNameEn: data.targetNameEn,
        category: data.category,
      })
    }

    return result
  }

  private inferCategoryFromCode(code: string): AccountCategory {
    const codeNum = parseInt(code, 10)
    if (isNaN(codeNum)) return 'sga_expense'

    if (codeNum >= 1000 && codeNum < 2000) return 'current_asset'
    if (codeNum >= 2000 && codeNum < 3000) return 'fixed_asset'
    if (codeNum >= 3000 && codeNum < 4000) return 'deferred_asset'
    if (codeNum >= 4000 && codeNum < 5000) return 'current_liability'
    if (codeNum >= 5000 && codeNum < 6000) return 'fixed_liability'
    if (codeNum >= 6000 && codeNum < 7000) return 'equity'
    if (codeNum >= 7000 && codeNum < 8000) return 'revenue'
    if (codeNum >= 8000 && codeNum < 9000) return 'cogs'
    if (codeNum >= 9000 && codeNum < 9500) return 'sga_expense'
    if (codeNum >= 9500 && codeNum < 9700) return 'non_operating_income'
    if (codeNum >= 9700 && codeNum < 9900) return 'non_operating_expense'
    if (codeNum >= 9900) return 'extraordinary_loss'

    return 'sga_expense'
  }

  private async getCashFlowMappings(
    companyId: string,
    fiscalYear: number
  ): Promise<Map<string, { section: 'operating' | 'investing' | 'financing' }>> {
    const mappings = new Map<string, { section: 'operating' | 'investing' | 'financing' }>()

    const cashFlowData = await prisma.cashFlow.findMany({
      where: {
        companyId,
        fiscalYear,
      },
      select: {
        category: true,
        itemName: true,
      },
    })

    for (const cf of cashFlowData) {
      const section = this.mapCashFlowCategoryToSection(cf.category)
      mappings.set(cf.itemName, { section })
    }

    return mappings
  }

  private mapCashFlowCategoryToSection(category: string): 'operating' | 'investing' | 'financing' {
    const operatingKeywords = [
      'operating',
      '営業',
      'net_income',
      'depreciation',
      'receivable',
      'payable',
      'inventory',
    ]
    const investingKeywords = ['investing', '投資', 'ppe', 'acquisition', 'sale_equipment']
    const financingKeywords = ['financing', '財務', 'debt', 'equity', 'dividend', 'borrowing']

    const lowerCategory = category.toLowerCase()

    if (operatingKeywords.some((k) => lowerCategory.includes(k))) return 'operating'
    if (investingKeywords.some((k) => lowerCategory.includes(k))) return 'investing'
    if (financingKeywords.some((k) => lowerCategory.includes(k))) return 'financing'

    return 'operating'
  }

  private compareBalanceSheets(
    source: ConvertedBalanceSheet,
    target: ConvertedBalanceSheet
  ): ComparisonItem[] {
    const items: ComparisonItem[] = []
    const processedCodes = new Set<string>()

    for (const sourceItem of [...source.assets, ...source.liabilities, ...source.equity]) {
      const targetItem = [...target.assets, ...target.liabilities, ...target.equity].find(
        (t) => t.code === sourceItem.code || t.sourceAccountCode?.includes(sourceItem.code)
      )

      if (targetItem && !processedCodes.has(sourceItem.code)) {
        const difference = targetItem.amount - sourceItem.amount
        const differencePercent =
          sourceItem.amount !== 0 ? (difference / Math.abs(sourceItem.amount)) * 100 : 0

        items.push({
          sourceName: sourceItem.name,
          targetName: targetItem.name,
          sourceAmount: sourceItem.amount,
          targetAmount: targetItem.amount,
          difference,
          differencePercent,
        })
        processedCodes.add(sourceItem.code)
      }
    }

    for (const targetItem of [...target.assets, ...target.liabilities, ...target.equity]) {
      if (!processedCodes.has(targetItem.code)) {
        const sourceAmount = 0
        const difference = targetItem.amount - sourceAmount

        items.push({
          sourceName: targetItem.sourceAccountCode || 'N/A',
          targetName: targetItem.name,
          sourceAmount,
          targetAmount: targetItem.amount,
          difference,
          differencePercent: 100,
        })
        processedCodes.add(targetItem.code)
      }
    }

    return items
  }

  private compareProfitLoss(
    source: ConvertedProfitLoss,
    target: ConvertedProfitLoss
  ): ComparisonItem[] {
    const items: ComparisonItem[] = []
    const processedCodes = new Set<string>()

    const sourceItems = [
      ...source.revenue,
      ...source.costOfSales,
      ...source.sgaExpenses,
      ...source.nonOperatingIncome,
      ...source.nonOperatingExpenses,
    ]

    const targetItems = [
      ...target.revenue,
      ...target.costOfSales,
      ...target.sgaExpenses,
      ...target.nonOperatingIncome,
      ...target.nonOperatingExpenses,
    ]

    for (const sourceItem of sourceItems) {
      const targetItem = targetItems.find(
        (t) => t.code === sourceItem.code || t.sourceAccountCode?.includes(sourceItem.code)
      )

      if (targetItem && !processedCodes.has(sourceItem.code)) {
        const difference = targetItem.amount - sourceItem.amount
        const differencePercent =
          sourceItem.amount !== 0 ? (difference / Math.abs(sourceItem.amount)) * 100 : 0

        items.push({
          sourceName: sourceItem.name,
          targetName: targetItem.name,
          sourceAmount: sourceItem.amount,
          targetAmount: targetItem.amount,
          difference,
          differencePercent,
        })
        processedCodes.add(sourceItem.code)
      }
    }

    for (const targetItem of targetItems) {
      if (!processedCodes.has(targetItem.code)) {
        items.push({
          sourceName: targetItem.sourceAccountCode || 'N/A',
          targetName: targetItem.name,
          sourceAmount: 0,
          targetAmount: targetItem.amount,
          difference: targetItem.amount,
          differencePercent: 100,
        })
        processedCodes.add(targetItem.code)
      }
    }

    return items
  }

  private identifySignificantDifferences(
    bsItems: ComparisonItem[],
    plItems: ComparisonItem[]
  ): SignificantDifference[] {
    const significant: SignificantDifference[] = []
    const threshold = 10

    for (const item of bsItems) {
      if (Math.abs(item.differencePercent) > threshold && Math.abs(item.difference) > 100000) {
        significant.push({
          item: item.targetName,
          sourceAmount: item.sourceAmount,
          targetAmount: item.targetAmount,
          difference: item.difference,
          differencePercent: item.differencePercent,
          reason: this.explainDifference(item),
        })
      }
    }

    for (const item of plItems) {
      if (Math.abs(item.differencePercent) > threshold && Math.abs(item.difference) > 100000) {
        significant.push({
          item: item.targetName,
          sourceAmount: item.sourceAmount,
          targetAmount: item.targetAmount,
          difference: item.difference,
          differencePercent: item.differencePercent,
          reason: this.explainDifference(item),
        })
      }
    }

    return significant.sort((a, b) => Math.abs(b.differencePercent) - Math.abs(a.differencePercent))
  }

  private explainDifference(item: ComparisonItem): string {
    if (item.sourceAmount === 0) {
      return 'New account in target COA with no corresponding source account'
    }
    if (item.targetAmount === 0) {
      return 'Account exists in source but not mapped to target'
    }
    if (Math.abs(item.differencePercent) > 50) {
      return 'Significant difference likely due to reclassification or different accounting treatment'
    }
    return 'Minor difference likely due to rounding or partial mapping'
  }
}

export const financialStatementConverter = new FinancialStatementConverter()
