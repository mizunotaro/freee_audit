import {
  ExportService,
  ExportOptions,
  ExportResult,
  ExportFormat,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  MonthlyReportData,
  ReportData,
  MIME_TYPES,
  FILE_EXTENSIONS,
  AccountItem,
} from './types'

export class PDFExportService implements ExportService<ReportData> {
  async export(data: ReportData, options: ExportOptions): Promise<ExportResult> {
    const filename = this.generateFilename(data, options)
    const pdfContent = await this.generatePDF(data, options)

    return {
      downloadUrl: `/api/export/download/${Buffer.from(filename).toString('base64')}`,
      filename,
      expiresAt: new Date(Date.now() + 3600000),
      fileSize: pdfContent.length,
      mimeType: MIME_TYPES.pdf,
    }
  }

  getSupportedFormats(): ExportFormat[] {
    return ['pdf']
  }

  private generateFilename(data: ReportData, options: ExportOptions): string {
    const reportType = this.getReportType(data)
    const date = new Date().toISOString().split('T')[0]
    const lang = options.language === 'dual' ? 'ja-en' : options.language
    return `${reportType}_${date}_${lang}${FILE_EXTENSIONS.pdf}`
  }

  private getReportType(data: ReportData): string {
    if ('balanceSheet' in data) return 'monthly_report'
    if ('assets' in data) return 'balance_sheet'
    if ('revenue' in data) return 'profit_loss'
    if ('operatingActivities' in data) return 'cash_flow'
    if ('months' in data) return 'cash_flow_statement'
    if ('profitability' in data) return 'kpi'
    return 'report'
  }

  private async generatePDF(data: ReportData, options: ExportOptions): Promise<Buffer> {
    // PDF generation using @react-pdf/renderer
    // This returns a placeholder - actual implementation would use react-pdf
    const content = this.renderPDFContent(data, options)
    return Buffer.from(content)
  }

  private renderPDFContent(data: ReportData, options: ExportOptions): string {
    const lines: string[] = []

    lines.push(this.renderHeader(options))

    if ('balanceSheet' in data) {
      lines.push(this.renderMonthlyReport(data as MonthlyReportData, options))
    } else if ('assets' in data) {
      lines.push(this.renderBalanceSheet(data as BalanceSheetData, options))
    } else if ('revenue' in data) {
      lines.push(this.renderProfitLoss(data as ProfitLossData, options))
    } else if ('operatingActivities' in data) {
      lines.push(this.renderCashFlow(data as CashFlowData, options))
    }

    return lines.join('\n')
  }

  private renderHeader(options: ExportOptions): string {
    const title = options.language === 'en' ? 'Financial Report' : '財務レポート'
    const date = new Date().toLocaleDateString(options.language === 'en' ? 'en-US' : 'ja-JP')

    return `
${title}
Generated: ${date}
Paper Size: ${options.paperSize}
Orientation: ${options.orientation}
${'='.repeat(80)}
`
  }

  private renderMonthlyReport(data: MonthlyReportData, options: ExportOptions): string {
    const lang = options.language
    return `
${lang === 'en' ? 'Monthly Report' : '月次レポート'} - ${data.fiscalYear}/${data.month}

${this.renderBalanceSheetSummary(data.balanceSheet, options)}
${this.renderProfitLossSummary(data.profitLoss, options)}
`
  }

  private renderBalanceSheet(data: BalanceSheetData, options: ExportOptions): string {
    const lang = options.language

    return `
${lang === 'en' ? 'Balance Sheet' : '貸借対照表'}
As of: ${data.asOfDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'ja-JP')}

${lang === 'en' ? 'Assets' : '資産の部'}
${'-'.repeat(40)}
${this.renderAccountItems(data.assets.current, lang)}
${this.renderAccountItems(data.assets.fixed, lang)}
${lang === 'en' ? 'Total Assets' : '資産合計'}: ${this.formatCurrency(data.assets.total, options)}

${lang === 'en' ? 'Liabilities' : '負債の部'}
${'-'.repeat(40)}
${this.renderAccountItems(data.liabilities.current, lang)}
${this.renderAccountItems(data.liabilities.fixed, lang)}
${lang === 'en' ? 'Total Liabilities' : '負債合計'}: ${this.formatCurrency(data.liabilities.total, options)}

${lang === 'en' ? 'Equity' : '純資産の部'}
${'-'.repeat(40)}
${this.renderAccountItems(data.equity.items, lang)}
${lang === 'en' ? 'Total Equity' : '純資産合計'}: ${this.formatCurrency(data.equity.total, options)}
`
  }

  private renderBalanceSheetSummary(data: BalanceSheetData, options: ExportOptions): string {
    const lang = options.language
    return `
${lang === 'en' ? 'Balance Sheet Summary' : '貸借対照表サマリー'}
Total Assets: ${this.formatCurrency(data.assets.total, options)}
Total Liabilities: ${this.formatCurrency(data.liabilities.total, options)}
Total Equity: ${this.formatCurrency(data.equity.total, options)}
`
  }

  private renderProfitLoss(data: ProfitLossData, options: ExportOptions): string {
    const lang = options.language

    return `
${lang === 'en' ? 'Profit and Loss Statement' : '損益計算書'}
Period: ${data.fiscalYear}/${data.startMonth} - ${data.endMonth}

${lang === 'en' ? 'Revenue' : '売上高'}: ${this.formatCurrency(data.revenue, options)}
${lang === 'en' ? 'Cost of Sales' : '売上原価'}: ${this.formatCurrency(data.costOfSales, options)}
${lang === 'en' ? 'Gross Profit' : '売上総利益'}: ${this.formatCurrency(data.grossProfit, options)}

${lang === 'en' ? 'SG&A Expenses' : '販売費及び一般管理費'}
${'-'.repeat(40)}
${this.renderAccountItems(data.sgaExpenses, lang)}

${lang === 'en' ? 'Operating Income' : '営業利益'}: ${this.formatCurrency(data.operatingIncome, options)}
${lang === 'en' ? 'Ordinary Income' : '経常利益'}: ${this.formatCurrency(data.ordinaryIncome, options)}
${lang === 'en' ? 'Net Income' : '当期純利益'}: ${this.formatCurrency(data.netIncome, options)}
`
  }

  private renderProfitLossSummary(data: ProfitLossData, options: ExportOptions): string {
    const lang = options.language
    return `
${lang === 'en' ? 'P&L Summary' : '損益計算書サマリー'}
Revenue: ${this.formatCurrency(data.revenue, options)}
Gross Profit: ${this.formatCurrency(data.grossProfit, options)}
Operating Income: ${this.formatCurrency(data.operatingIncome, options)}
Net Income: ${this.formatCurrency(data.netIncome, options)}
`
  }

  private renderCashFlow(data: CashFlowData, options: ExportOptions): string {
    const lang = options.language

    return `
${lang === 'en' ? 'Cash Flow Statement' : 'キャッシュフロー計算書'}

${lang === 'en' ? 'Operating Activities' : '営業活動'}
${'-'.repeat(40)}
${this.renderAccountItems(data.operatingActivities.adjustments, lang)}
${lang === 'en' ? 'Net Cash from Operating' : '営業CF合計'}: ${this.formatCurrency(data.operatingActivities.netCashFromOperating, options)}

${lang === 'en' ? 'Investing Activities' : '投資活動'}
${'-'.repeat(40)}
${this.renderAccountItems(data.investingActivities.items, lang)}
${lang === 'en' ? 'Net Cash from Investing' : '投資CF合計'}: ${this.formatCurrency(data.investingActivities.netCashFromInvesting, options)}

${lang === 'en' ? 'Financing Activities' : '財務活動'}
${'-'.repeat(40)}
${this.renderAccountItems(data.financingActivities.items, lang)}
${lang === 'en' ? 'Net Cash from Financing' : '財務CF合計'}: ${this.formatCurrency(data.financingActivities.netCashFromFinancing, options)}

${lang === 'en' ? 'Net Change in Cash' : '現金増減'}: ${this.formatCurrency(data.netChangeInCash, options)}
${lang === 'en' ? 'Beginning Cash' : '期首現金'}: ${this.formatCurrency(data.beginningCash, options)}
${lang === 'en' ? 'Ending Cash' : '期末現金'}: ${this.formatCurrency(data.endingCash, options)}
`
  }

  private renderAccountItems(items: AccountItem[], lang: 'ja' | 'en' | 'dual'): string {
    return items
      .map((item) => {
        const name = lang === 'en' && item.nameEn ? item.nameEn : item.name
        const amount = this.formatAmount(item.amount)
        return `  ${name}: ${amount}`
      })
      .join('\n')
  }

  private formatCurrency(amount: number, options: ExportOptions): string {
    const formatted = this.formatAmount(amount)
    if (options.currency === 'dual' && options.exchangeRate) {
      const converted = amount / options.exchangeRate
      return `¥${formatted} ($${this.formatAmount(converted)} @${options.exchangeRate.toFixed(2)})`
    }
    return options.currency === 'USD' ? `$${formatted}` : `¥${formatted}`
  }

  private formatAmount(amount: number): string {
    return Math.abs(amount).toLocaleString('ja-JP')
  }
}

export function createPDFExportService(): ExportService<ReportData> {
  return new PDFExportService()
}
