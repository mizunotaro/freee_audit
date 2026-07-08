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
import {
  type AppError,
  type Result,
  ERROR_CODES,
  createAppError,
  failure,
  success,
} from '@/types/result'

export function createExportService(
  format: ExportFormat
): Result<ExportService<ReportData>, AppError> {
  switch (format) {
    case 'pdf':
      return success(createPDFExportService())
    case 'pptx':
      return success(createPPTXExportService())
    case 'excel':
    case 'csv':
      return success(createExcelExportService())
    default:
      return failure(
        createAppError(ERROR_CODES.BUSINESS_LOGIC_ERROR, `Unsupported export format: ${format}`, {
          details: { format },
        })
      )
  }
}
