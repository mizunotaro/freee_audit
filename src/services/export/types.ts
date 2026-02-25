export type ExportFormat = 'pdf' | 'pptx' | 'excel' | 'csv'

export type ReportType =
  | 'balance_sheet'
  | 'profit_loss'
  | 'cash_flow'
  | 'cash_flow_statement'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'kpi'

export type ExportLanguage = 'ja' | 'en' | 'dual'

export type ExportCurrency = 'JPY' | 'USD' | 'dual'

export type PaperSize = 'A4' | 'A3' | 'Letter'

export type Orientation = 'portrait' | 'landscape'

export interface ExportOptions {
  format: ExportFormat
  language: ExportLanguage
  currency: ExportCurrency
  includeCharts: boolean
  paperSize: PaperSize
  orientation: Orientation
  exchangeRate?: number
}

export interface ExportRequest {
  reportType: ReportType
  fiscalYear: number
  month?: number
  quarter?: number
  options: ExportOptions
}

export interface ExportResult {
  downloadUrl: string
  filename: string
  expiresAt: Date
  fileSize: number
  mimeType: string
}

export interface ExportProgress {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  result?: ExportResult
  error?: string
}

export interface ExportService<T = unknown> {
  export(data: T, options: ExportOptions): Promise<ExportResult>
  getSupportedFormats(): ExportFormat[]
}

export interface BalanceSheetData {
  fiscalYear: number
  month: number
  asOfDate: Date
  assets: {
    current: AccountItem[]
    fixed: AccountItem[]
    total: number
  }
  liabilities: {
    current: AccountItem[]
    fixed: AccountItem[]
    total: number
  }
  equity: {
    items: AccountItem[]
    total: number
  }
}

export interface ProfitLossData {
  fiscalYear: number
  startMonth: number
  endMonth: number
  revenue: number
  costOfSales: number
  grossProfit: number
  sgaExpenses: AccountItem[]
  operatingIncome: number
  nonOperatingIncome: number
  nonOperatingExpenses: number
  ordinaryIncome: number
  extraordinaryIncome: number
  extraordinaryLoss: number
  incomeBeforeTax: number
  corporateTax: number
  netIncome: number
}

export interface CashFlowData {
  fiscalYear: number
  month: number
  operatingActivities: {
    netIncome: number
    adjustments: AccountItem[]
    netCashFromOperating: number
  }
  investingActivities: {
    items: AccountItem[]
    netCashFromInvesting: number
  }
  financingActivities: {
    items: AccountItem[]
    netCashFromFinancing: number
  }
  netChangeInCash: number
  beginningCash: number
  endingCash: number
}

export interface CashFlowStatementData {
  fiscalYear: number
  months: MonthlyCashFlow[]
}

export interface MonthlyCashFlow {
  month: number
  openingBalance: number
  operatingReceipts: AccountItem[]
  operatingPayments: AccountItem[]
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  netChange: number
  closingBalance: number
}

export interface KPIData {
  fiscalYear: number
  month: number
  profitability: KPIItem[]
  efficiency: KPIItem[]
  safety: KPIItem[]
  growth: KPIItem[]
  cashFlow: KPIItem[]
}

export interface AccountItem {
  code?: string
  name: string
  nameEn?: string
  amount: number
  children?: AccountItem[]
}

export interface KPIItem {
  key: string
  name: string
  nameEn: string
  value: number
  unit: string
  target?: number
  previousValue?: number
  trend?: 'up' | 'down' | 'stable'
}

export interface MonthlyReportData {
  fiscalYear: number
  month: number
  balanceSheet: BalanceSheetData
  profitLoss: ProfitLossData
  cashFlow: CashFlowData
  kpi: KPIData
  summary: {
    highlights: string[]
    issues: string[]
    nextMonthGoals: string[]
  }
}

export type ReportData =
  | BalanceSheetData
  | ProfitLossData
  | CashFlowData
  | CashFlowStatementData
  | KPIData
  | MonthlyReportData

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'pdf',
  language: 'ja',
  currency: 'JPY',
  includeCharts: true,
  paperSize: 'A4',
  orientation: 'landscape',
}

export const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
}

export const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  pdf: '.pdf',
  pptx: '.pptx',
  excel: '.xlsx',
  csv: '.csv',
}
