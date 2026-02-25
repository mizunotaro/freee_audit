import {
  ExportService,
  ExportOptions,
  ExportResult,
  ExportFormat,
  ReportData,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  KPIData,
  MonthlyReportData,
  MIME_TYPES,
  FILE_EXTENSIONS,
} from './types'

interface Slide {
  title: string
  content: SlideContent[]
}

interface SlideContent {
  type: 'text' | 'table' | 'chart' | 'bullet'
  data: unknown
}

export class PPTXExportService implements ExportService<ReportData> {
  async export(data: ReportData, options: ExportOptions): Promise<ExportResult> {
    const filename = this.generateFilename(data, options)
    const pptxContent = await this.generatePPTX(data, options)

    return {
      downloadUrl: `/api/export/download/${Buffer.from(filename).toString('base64')}`,
      filename,
      expiresAt: new Date(Date.now() + 3600000),
      fileSize: pptxContent.length,
      mimeType: MIME_TYPES.pptx,
    }
  }

  getSupportedFormats(): ExportFormat[] {
    return ['pptx']
  }

  private generateFilename(data: ReportData, options: ExportOptions): string {
    const reportType = this.getReportType(data)
    const date = new Date().toISOString().split('T')[0]
    const lang = options.language === 'dual' ? 'ja-en' : options.language
    return `${reportType}_${date}_${lang}${FILE_EXTENSIONS.pptx}`
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

  private async generatePPTX(data: ReportData, options: ExportOptions): Promise<Buffer> {
    const slides = this.createSlides(data, options)
    return this.buildPPTX(slides, options)
  }

  private createSlides(data: ReportData, options: ExportOptions): Slide[] {
    const slides: Slide[] = []
    const lang = options.language

    // Title slide
    slides.push(this.createTitleSlide(data, lang))

    if ('balanceSheet' in data) {
      const monthlyData = data as MonthlyReportData
      slides.push(this.createExecutiveSummarySlide(monthlyData, lang))
      slides.push(this.createBalanceSheetSlide(monthlyData.balanceSheet, lang))
      slides.push(this.createProfitLossSlide(monthlyData.profitLoss, lang))
      slides.push(this.createCashFlowSlide(monthlyData.cashFlow, lang))
      slides.push(this.createKPISlide(monthlyData.kpi, lang))
    } else if ('assets' in data) {
      slides.push(this.createBalanceSheetSlide(data as BalanceSheetData, lang))
    } else if ('revenue' in data) {
      slides.push(this.createProfitLossSlide(data as ProfitLossData, lang))
    } else if ('operatingActivities' in data) {
      slides.push(this.createCashFlowSlide(data as CashFlowData, lang))
    } else if ('profitability' in data) {
      slides.push(this.createKPISlide(data as KPIData, lang))
    }

    return slides
  }

  private createTitleSlide(data: ReportData, lang: 'ja' | 'en' | 'dual'): Slide {
    const title = lang === 'en' ? 'Financial Report' : '財務レポート'
    const subtitle = this.getDateRange(data, lang)

    return {
      title,
      content: [
        { type: 'text', data: subtitle },
        { type: 'text', data: new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'ja-JP') },
      ],
    }
  }

  private createExecutiveSummarySlide(data: MonthlyReportData, lang: 'ja' | 'en' | 'dual'): Slide {
    const title = lang === 'en' ? 'Executive Summary' : 'エグゼクティブサマリー'

    return {
      title,
      content: [
        {
          type: 'bullet',
          data: data.summary.highlights,
        },
        {
          type: 'bullet',
          data: data.summary.issues,
        },
      ],
    }
  }

  private createBalanceSheetSlide(data: BalanceSheetData, lang: 'ja' | 'en' | 'dual'): Slide {
    const title = lang === 'en' ? 'Balance Sheet' : '貸借対照表'

    const tableData = [
      [lang === 'en' ? 'Item' : '科目', lang === 'en' ? 'Amount' : '金額'],
      ...data.assets.current.map((item) => [item.name, this.formatAmount(item.amount)]),
      [lang === 'en' ? 'Total Assets' : '資産合計', this.formatAmount(data.assets.total)],
      ...data.liabilities.current.map((item) => [item.name, this.formatAmount(item.amount)]),
      [lang === 'en' ? 'Total Liabilities' : '負債合計', this.formatAmount(data.liabilities.total)],
      [lang === 'en' ? 'Total Equity' : '純資産合計', this.formatAmount(data.equity.total)],
    ]

    return {
      title,
      content: [{ type: 'table', data: tableData }],
    }
  }

  private createProfitLossSlide(data: ProfitLossData, lang: 'ja' | 'en' | 'dual'): Slide {
    const title = lang === 'en' ? 'Profit and Loss Statement' : '損益計算書'

    const tableData = [
      [lang === 'en' ? 'Item' : '科目', lang === 'en' ? 'Amount' : '金額'],
      [lang === 'en' ? 'Revenue' : '売上高', this.formatAmount(data.revenue)],
      [lang === 'en' ? 'Cost of Sales' : '売上原価', this.formatAmount(data.costOfSales)],
      [lang === 'en' ? 'Gross Profit' : '売上総利益', this.formatAmount(data.grossProfit)],
      [lang === 'en' ? 'Operating Income' : '営業利益', this.formatAmount(data.operatingIncome)],
      [lang === 'en' ? 'Ordinary Income' : '経常利益', this.formatAmount(data.ordinaryIncome)],
      [lang === 'en' ? 'Net Income' : '当期純利益', this.formatAmount(data.netIncome)],
    ]

    return {
      title,
      content: [{ type: 'table', data: tableData }],
    }
  }

  private createCashFlowSlide(data: CashFlowData, lang: 'ja' | 'en' | 'dual'): Slide {
    const title = lang === 'en' ? 'Cash Flow Statement' : 'キャッシュフロー計算書'

    const tableData = [
      [lang === 'en' ? 'Item' : '科目', lang === 'en' ? 'Amount' : '金額'],
      [
        lang === 'en' ? 'Operating Cash Flow' : '営業CF',
        this.formatAmount(data.operatingActivities.netCashFromOperating),
      ],
      [
        lang === 'en' ? 'Investing Cash Flow' : '投資CF',
        this.formatAmount(data.investingActivities.netCashFromInvesting),
      ],
      [
        lang === 'en' ? 'Financing Cash Flow' : '財務CF',
        this.formatAmount(data.financingActivities.netCashFromFinancing),
      ],
      [lang === 'en' ? 'Net Change in Cash' : '現金増減', this.formatAmount(data.netChangeInCash)],
      [lang === 'en' ? 'Beginning Cash' : '期首現金', this.formatAmount(data.beginningCash)],
      [lang === 'en' ? 'Ending Cash' : '期末現金', this.formatAmount(data.endingCash)],
    ]

    return {
      title,
      content: [{ type: 'table', data: tableData }],
    }
  }

  private createKPISlide(data: KPIData, lang: 'ja' | 'en' | 'dual'): Slide {
    const title = lang === 'en' ? 'Key Performance Indicators' : '経営指標'

    const allKPIs = [
      ...data.profitability,
      ...data.efficiency,
      ...data.safety,
      ...data.growth,
      ...data.cashFlow,
    ]

    const tableData = [
      [
        lang === 'en' ? 'KPI' : '指標',
        lang === 'en' ? 'Value' : '値',
        lang === 'en' ? 'Unit' : '単位',
      ],
      ...allKPIs.map((kpi) => [kpi.name, kpi.value.toFixed(2), kpi.unit]),
    ]

    return {
      title,
      content: [{ type: 'table', data: tableData }],
    }
  }

  private buildPPTX(slides: Slide[], _options: ExportOptions): Buffer {
    // PPTX generation using pptxgenjs
    // This returns a placeholder - actual implementation would use pptxgenjs

    const content = slides
      .map(
        (slide) => `
${slide.title}
${'='.repeat(60)}
${slide.content.map((c) => this.renderContent(c)).join('\n')}
`
      )
      .join('\n---\n')

    return Buffer.from(content)
  }

  private renderContent(content: SlideContent): string {
    switch (content.type) {
      case 'text':
        return String(content.data)
      case 'bullet':
        return (content.data as string[]).map((item) => `• ${item}`).join('\n')
      case 'table':
        return (content.data as string[][]).map((row) => row.join(' | ')).join('\n')
      default:
        return ''
    }
  }

  private getDateRange(data: ReportData, _lang: 'ja' | 'en' | 'dual'): string {
    if ('fiscalYear' in data) {
      if ('month' in data && typeof data.month === 'number') {
        return `${data.fiscalYear}/${data.month}`
      }
      return `${data.fiscalYear}`
    }
    return ''
  }

  private formatAmount(amount: number): string {
    return Math.abs(amount).toLocaleString('ja-JP')
  }
}

export function createPPTXExportService(): ExportService<ReportData> {
  return new PPTXExportService()
}
