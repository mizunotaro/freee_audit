import type { Exporter, ExporterContext } from './types'
import type { ConversionResult, ExportConfig } from '@/types/conversion'

export class JSONExporter implements Exporter {
  async export(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const data = this.generateJSON(result, config, context)
    const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
    const fileName = this.generateFileName(context)

    return {
      buffer,
      fileName,
      mimeType: 'application/json',
    }
  }

  private generateJSON(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {
      metadata: {
        projectId: result.projectId,
        companyName: context.companyName,
        sourceStandard: context.sourceStandard,
        targetStandard: context.targetStandard,
        periodStart: context.periodStart.toISOString(),
        periodEnd: context.periodEnd.toISOString(),
        conversionDate: result.conversionDate.toISOString(),
        conversionDurationMs: result.conversionDurationMs,
        exportedAt: new Date().toISOString(),
        exportConfig: config,
      },
    }

    output.balanceSheet = config.includeFinancialStatements ? (result.balanceSheet ?? null) : null
    output.profitLoss = config.includeFinancialStatements ? (result.profitLoss ?? null) : null
    output.cashFlow = config.includeFinancialStatements ? (result.cashFlow ?? null) : null

    output.journalConversions = config.includeJournals ? (result.journalConversions ?? []) : []
    output.adjustingEntries = config.includeAdjustingEntries ? (result.adjustingEntries ?? []) : []
    output.disclosures = config.includeDisclosures ? (result.disclosures ?? []) : []

    output.aiAnalysis = config.includeAIAnalysis ? (result.aiAnalysis ?? null) : null

    output.warnings = result.warnings
    output.errors = result.errors

    return output
  }

  private generateFileName(context: ExporterContext): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = context.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `conversion_${safeName}_${dateStr}.json`
  }
}
