export type {
  ExportFormat,
  ReportType,
  ExportLanguage,
  ExportCurrency,
  PaperSize,
  Orientation,
  ExportOptions,
  ExportRequest,
  ExportResult,
  ExportProgress,
  ExportService,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  CashFlowStatementData,
  MonthlyCashFlow,
  KPIData,
  AccountItem,
  KPIItem,
  MonthlyReportData,
  ReportData,
} from './types'

export { DEFAULT_EXPORT_OPTIONS, MIME_TYPES, FILE_EXTENSIONS } from './types'

export { createPDFExportService, PDFExportService } from './pdf-export'
export { createPPTXExportService, PPTXExportService } from './pptx-export'
export { createExcelExportService, ExcelExportService } from './excel-export'

import { createPDFExportService } from './pdf-export'
import { createPPTXExportService } from './pptx-export'
import { createExcelExportService } from './excel-export'
import { ExportFormat, ExportService, ReportData } from './types'

export function createExportService(format: ExportFormat): ExportService<ReportData> {
  switch (format) {
    case 'pdf':
      return createPDFExportService()
    case 'pptx':
      return createPPTXExportService()
    case 'excel':
    case 'csv':
      return createExcelExportService()
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
