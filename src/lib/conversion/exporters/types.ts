import type { ConversionResult, ExportConfig } from '@/types/conversion'

export interface ExporterContext {
  projectId: string
  projectName: string
  companyName: string
  sourceStandard: string
  targetStandard: string
  periodStart: Date
  periodEnd: Date
}

export interface Exporter {
  export(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }>
}

export const EXPORT_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  json: 'application/json',
}

export const EXPORT_EXTENSIONS: Record<string, string> = {
  pdf: '.pdf',
  excel: '.xlsx',
  csv: '.csv',
  json: '.json',
}
