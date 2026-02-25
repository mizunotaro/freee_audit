import {
  ExportService,
  ExportOptions,
  ExportResult,
  ExportFormat,
  ReportData,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  CashFlowStatementData,
  KPIData,
  MonthlyReportData,
  MIME_TYPES,
  FILE_EXTENSIONS,
  AccountItem,
  KPIItem,
  MonthlyCashFlow,
} from './types'

interface Sheet {
  name: string
  data: unknown[][]
}

export class ExcelExportService implements ExportService<ReportData> {
  async export(data: ReportData, options: ExportOptions): Promise<ExportResult> {
    const filename = this.generateFilename(data, options)
    const excelContent = await this.generateExcel(data, options)

    return {
      downloadUrl: `/api/export/download/${Buffer.from(filename).toString('base64')}`,
      filename,
      expiresAt: new Date(Date.now() + 3600000),
      fileSize: excelContent.length,
      mimeType: MIME_TYPES.excel,
    }
  }

  getSupportedFormats(): ExportFormat[] {
    return ['excel', 'csv']
  }

  async exportCSV(data: ReportData, options: ExportOptions): Promise<ExportResult> {
    const filename = this.generateFilename(data, { ...options, format: 'csv' })
    const csvContent = this.generateCSV(data, options)

    return {
      downloadUrl: `/api/export/download/${Buffer.from(filename).toString('base64')}`,
      filename,
      expiresAt: new Date(Date.now() + 3600000),
      fileSize: Buffer.byteLength(csvContent),
      mimeType: MIME_TYPES.csv,
    }
  }

  private generateFilename(data: ReportData, options: ExportOptions): string {
    const reportType = this.getReportType(data)
    const date = new Date().toISOString().split('T')[0]
    const lang = options.language === 'dual' ? 'ja-en' : options.language
    const ext = FILE_EXTENSIONS[options.format]
    return `${reportType}_${date}_${lang}${ext}`
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

  private async generateExcel(data: ReportData, options: ExportOptions): Promise<Buffer> {
    const sheets = this.createSheets(data, options)
    return this.buildExcel(sheets, options)
  }

  private createSheets(data: ReportData, options: ExportOptions): Sheet[] {
    const sheets: Sheet[] = []
    const lang = options.language

    if ('balanceSheet' in data) {
      const monthlyData = data as MonthlyReportData
      sheets.push(this.createSummarySheet(monthlyData, lang))
      sheets.push(this.createBalanceSheetSheet(monthlyData.balanceSheet, lang))
      sheets.push(this.createProfitLossSheet(monthlyData.profitLoss, lang))
      sheets.push(this.createCashFlowSheet(monthlyData.cashFlow, lang))
      sheets.push(this.createKPISheet(monthlyData.kpi, lang))
    } else if ('assets' in data) {
      sheets.push(this.createBalanceSheetSheet(data as BalanceSheetData, lang))
    } else if ('revenue' in data) {
      sheets.push(this.createProfitLossSheet(data as ProfitLossData, lang))
    } else if ('operatingActivities' in data) {
      sheets.push(this.createCashFlowSheet(data as CashFlowData, lang))
    } else if ('months' in data) {
      sheets.push(this.createCashFlowStatementSheet(data as CashFlowStatementData, lang))
    } else if ('profitability' in data) {
      sheets.push(this.createKPISheet(data as KPIData, lang))
    }

    return sheets
  }

  private createSummarySheet(data: MonthlyReportData, lang: 'ja' | 'en' | 'dual'): Sheet {
    return {
      name: lang === 'en' ? 'Summary' : '概要',
      data: [
        [lang === 'en' ? 'Monthly Report' : '月次レポート'],
        [lang === 'en' ? 'Fiscal Year' : '会計年度', data.fiscalYear],
        [lang === 'en' ? 'Month' : '月', data.month],
        [],
        [lang === 'en' ? 'Highlights' : 'ハイライト'],
        ...data.summary.highlights.map((h) => [h]),
        [],
        [lang === 'en' ? 'Issues' : '課題'],
        ...data.summary.issues.map((i) => [i]),
      ],
    }
  }

  private createBalanceSheetSheet(data: BalanceSheetData, lang: 'ja' | 'en' | 'dual'): Sheet {
    const sheetData: unknown[][] = [
      [lang === 'en' ? 'Balance Sheet' : '貸借対照表'],
      [lang === 'en' ? 'As of' : '基準日', data.asOfDate.toLocaleDateString()],
      [],
      [lang === 'en' ? 'Item' : '科目', lang === 'en' ? 'Amount' : '金額'],
    ]

    sheetData.push([lang === 'en' ? '【Assets】' : '【資産の部】'])
    sheetData.push([lang === 'en' ? 'Current Assets' : '流動資産'])
    data.assets.current.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([lang === 'en' ? 'Fixed Assets' : '固定資産'])
    data.assets.fixed.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([lang === 'en' ? 'Total Assets' : '資産合計', data.assets.total])

    sheetData.push([])
    sheetData.push([lang === 'en' ? '【Liabilities】' : '【負債の部】'])
    sheetData.push([lang === 'en' ? 'Current Liabilities' : '流動負債'])
    data.liabilities.current.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([lang === 'en' ? 'Fixed Liabilities' : '固定負債'])
    data.liabilities.fixed.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([lang === 'en' ? 'Total Liabilities' : '負債合計', data.liabilities.total])

    sheetData.push([])
    sheetData.push([lang === 'en' ? '【Equity】' : '【純資産の部】'])
    data.equity.items.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([lang === 'en' ? 'Total Equity' : '純資産合計', data.equity.total])
    sheetData.push([])
    sheetData.push([
      lang === 'en' ? 'Total Liabilities and Equity' : '負債・純資産合計',
      data.assets.total,
    ])

    return {
      name: lang === 'en' ? 'BS' : '貸借対照表',
      data: sheetData,
    }
  }

  private createProfitLossSheet(data: ProfitLossData, lang: 'ja' | 'en' | 'dual'): Sheet {
    const sheetData: unknown[][] = [
      [lang === 'en' ? 'Profit and Loss Statement' : '損益計算書'],
      [
        lang === 'en' ? 'Period' : '期間',
        `${data.fiscalYear}/${data.startMonth} - ${data.endMonth}`,
      ],
      [],
      [lang === 'en' ? 'Item' : '科目', lang === 'en' ? 'Amount' : '金額'],
      [lang === 'en' ? 'Revenue' : '売上高', data.revenue],
      [lang === 'en' ? 'Cost of Sales' : '売上原価', data.costOfSales],
      [lang === 'en' ? 'Gross Profit' : '売上総利益', data.grossProfit],
      [],
      [lang === 'en' ? 'SG&A Expenses' : '販売費及び一般管理費'],
    ]

    data.sgaExpenses.forEach((item) => {
      sheetData.push([`  ${item.name}`, item.amount])
    })

    sheetData.push([])
    sheetData.push([lang === 'en' ? 'Operating Income' : '営業利益', data.operatingIncome])
    sheetData.push([lang === 'en' ? 'Non-Operating Income' : '営業外収益', data.nonOperatingIncome])
    sheetData.push([
      lang === 'en' ? 'Non-Operating Expenses' : '営業外費用',
      data.nonOperatingExpenses,
    ])
    sheetData.push([lang === 'en' ? 'Ordinary Income' : '経常利益', data.ordinaryIncome])
    sheetData.push([lang === 'en' ? 'Extraordinary Income' : '特別利益', data.extraordinaryIncome])
    sheetData.push([lang === 'en' ? 'Extraordinary Loss' : '特別損失', data.extraordinaryLoss])
    sheetData.push([lang === 'en' ? 'Income Before Tax' : '税引前当期純利益', data.incomeBeforeTax])
    sheetData.push([lang === 'en' ? 'Corporate Tax' : '法人税等', data.corporateTax])
    sheetData.push([lang === 'en' ? 'Net Income' : '当期純利益', data.netIncome])

    return {
      name: lang === 'en' ? 'PL' : '損益計算書',
      data: sheetData,
    }
  }

  private createCashFlowSheet(data: CashFlowData, lang: 'ja' | 'en' | 'dual'): Sheet {
    const sheetData: unknown[][] = [
      [lang === 'en' ? 'Cash Flow Statement' : 'キャッシュフロー計算書'],
      [lang === 'en' ? 'Fiscal Year' : '会計年度', data.fiscalYear],
      [lang === 'en' ? 'Month' : '月', data.month],
      [],
      [lang === 'en' ? 'Operating Activities' : '営業活動'],
      [lang === 'en' ? 'Net Income' : '当期純利益', data.operatingActivities.netIncome],
    ]

    data.operatingActivities.adjustments.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([
      lang === 'en' ? 'Net Cash from Operating' : '営業CF合計',
      data.operatingActivities.netCashFromOperating,
    ])

    sheetData.push([])
    sheetData.push([lang === 'en' ? 'Investing Activities' : '投資活動'])
    data.investingActivities.items.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([
      lang === 'en' ? 'Net Cash from Investing' : '投資CF合計',
      data.investingActivities.netCashFromInvesting,
    ])

    sheetData.push([])
    sheetData.push([lang === 'en' ? 'Financing Activities' : '財務活動'])
    data.financingActivities.items.forEach((item) => {
      sheetData.push([item.name, item.amount])
    })
    sheetData.push([
      lang === 'en' ? 'Net Cash from Financing' : '財務CF合計',
      data.financingActivities.netCashFromFinancing,
    ])

    sheetData.push([])
    sheetData.push([lang === 'en' ? 'Net Change in Cash' : '現金増減', data.netChangeInCash])
    sheetData.push([lang === 'en' ? 'Beginning Cash' : '期首現金', data.beginningCash])
    sheetData.push([lang === 'en' ? 'Ending Cash' : '期末現金', data.endingCash])

    return {
      name: lang === 'en' ? 'CF' : 'キャッシュフロー',
      data: sheetData,
    }
  }

  private createCashFlowStatementSheet(
    data: CashFlowStatementData,
    lang: 'ja' | 'en' | 'dual'
  ): Sheet {
    const monthNames =
      lang === 'en'
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

    const headerRow = [
      lang === 'en' ? 'Item' : '項目',
      ...monthNames,
      lang === 'en' ? 'Total' : '合計',
    ]
    const sheetData: unknown[][] = [
      [lang === 'en' ? 'Cash Flow Statement' : '資金繰り表'],
      [lang === 'en' ? 'Fiscal Year' : '会計年度', data.fiscalYear],
      [],
      headerRow,
    ]

    const months = data.months

    sheetData.push(
      this.createRow(
        lang === 'en' ? 'Opening Balance' : '期首残高',
        months,
        (m) => m.openingBalance
      )
    )
    sheetData.push([])
    sheetData.push(
      this.createRow(lang === 'en' ? 'Sales Receipts' : '売上入金', months, (m) =>
        this.sumItems(m.operatingReceipts)
      )
    )
    sheetData.push(
      this.createRow(lang === 'en' ? 'Purchase Payments' : '仕入支払', months, (m) =>
        this.sumItems(m.operatingPayments)
      )
    )
    sheetData.push(
      this.createRow(lang === 'en' ? 'Operating CF' : '営業CF', months, (m) => m.operatingCashFlow)
    )
    sheetData.push(
      this.createRow(lang === 'en' ? 'Investing CF' : '投資CF', months, (m) => m.investingCashFlow)
    )
    sheetData.push(
      this.createRow(lang === 'en' ? 'Financing CF' : '財務CF', months, (m) => m.financingCashFlow)
    )
    sheetData.push([])
    sheetData.push(
      this.createRow(lang === 'en' ? 'Net Change' : '収支差引', months, (m) => m.netChange)
    )
    sheetData.push(
      this.createRow(
        lang === 'en' ? 'Closing Balance' : '期末残高',
        months,
        (m) => m.closingBalance
      )
    )

    return {
      name: lang === 'en' ? 'Cash Flow' : '資金繰り表',
      data: sheetData,
    }
  }

  private createKPISheet(data: KPIData, lang: 'ja' | 'en' | 'dual'): Sheet {
    const sheetData: unknown[][] = [
      [lang === 'en' ? 'Key Performance Indicators' : '経営指標'],
      [],
      [
        lang === 'en' ? 'Category' : 'カテゴリ',
        lang === 'en' ? 'KPI' : '指標',
        lang === 'en' ? 'Value' : '値',
        lang === 'en' ? 'Unit' : '単位',
        lang === 'en' ? 'Target' : '目標',
        lang === 'en' ? 'Previous' : '前期',
        lang === 'en' ? 'Trend' : '傾向',
      ],
    ]

    const categories: { key: keyof KPIData; name: string; nameEn: string }[] = [
      { key: 'profitability', name: '収益性', nameEn: 'Profitability' },
      { key: 'efficiency', name: '効率性', nameEn: 'Efficiency' },
      { key: 'safety', name: '安全性', nameEn: 'Safety' },
      { key: 'growth', name: '成長性', nameEn: 'Growth' },
      { key: 'cashFlow', name: 'キャッシュフロー', nameEn: 'Cash Flow' },
    ]

    categories.forEach((cat) => {
      const kpis = data[cat.key] as KPIItem[]
      kpis.forEach((kpi) => {
        sheetData.push([
          lang === 'en' ? cat.nameEn : cat.name,
          kpi.name,
          kpi.value,
          kpi.unit,
          kpi.target ?? '',
          kpi.previousValue ?? '',
          kpi.trend ?? '',
        ])
      })
    })

    return {
      name: lang === 'en' ? 'KPI' : '経営指標',
      data: sheetData,
    }
  }

  private createRow(
    label: string,
    months: MonthlyCashFlow[],
    getValue: (m: MonthlyCashFlow) => number
  ): unknown[] {
    const values = months.map((m) => getValue(m))
    const total = values.reduce((sum, v) => sum + v, 0)
    return [label, ...values, total]
  }

  private sumItems(items: AccountItem[]): number {
    return items.reduce((sum, item) => sum + item.amount, 0)
  }

  private buildExcel(sheets: Sheet[], _options: ExportOptions): Buffer {
    // Excel generation using xlsx (SheetJS)
    // This returns a placeholder - actual implementation would use xlsx

    const content = sheets
      .map(
        (sheet) => `
Sheet: ${sheet.name}
${'='.repeat(60)}
${sheet.data.map((row) => row.join('\t')).join('\n')}
`
      )
      .join('\n\n')

    return Buffer.from(content)
  }

  private generateCSV(data: ReportData, options: ExportOptions): string {
    const sheets = this.createSheets(data, options)
    const firstSheet = sheets[0]

    return firstSheet.data
      .map((row) =>
        row
          .map((cell) => {
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
              return `"${cell.replace(/"/g, '""')}"`
            }
            return String(cell ?? '')
          })
          .join(',')
      )
      .join('\n')
  }
}

export function createExcelExportService(): ExcelExportService {
  return new ExcelExportService()
}
