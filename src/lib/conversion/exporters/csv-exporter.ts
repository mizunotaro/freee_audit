import type { Exporter, ExporterContext } from './types'
import type { ConversionResult, ExportConfig } from '@/types/conversion'

export class CSVExporter implements Exporter {
  async export(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const csv = this.generateCSV(result, config, context)
    const buffer = Buffer.from(csv, 'utf-8')
    const fileName = this.generateFileName(context)

    return {
      buffer,
      fileName,
      mimeType: 'text/csv',
    }
  }

  private generateCSV(
    result: ConversionResult,
    config: ExportConfig,
    _context: ExporterContext
  ): string {
    const rows: string[][] = []
    const lang = config.language === 'en' ? 'en' : 'ja'

    rows.push([
      'record_type',
      'account_code',
      'account_name',
      'account_name_en',
      'amount',
      'source_account_code',
      'category',
      'reference',
    ])

    if (config.includeFinancialStatements && result.balanceSheet) {
      for (const a of result.balanceSheet.assets) {
        rows.push([
          'balance_sheet',
          a.code,
          a.name,
          a.nameEn,
          String(a.amount),
          a.sourceAccountCode ?? '',
          'asset',
          '',
        ])
      }
      for (const l of result.balanceSheet.liabilities) {
        rows.push([
          'balance_sheet',
          l.code,
          l.name,
          l.nameEn,
          String(l.amount),
          l.sourceAccountCode ?? '',
          'liability',
          '',
        ])
      }
      for (const e of result.balanceSheet.equity) {
        rows.push([
          'balance_sheet',
          e.code,
          e.name,
          e.nameEn,
          String(e.amount),
          e.sourceAccountCode ?? '',
          'equity',
          '',
        ])
      }
    }

    if (config.includeJournals && result.journalConversions) {
      for (const jc of result.journalConversions) {
        for (const line of jc.lines) {
          rows.push([
            'journal',
            line.targetAccountCode,
            line.targetAccountName,
            line.targetAccountName,
            String(line.debitAmount || line.creditAmount),
            line.sourceAccountCode,
            line.debitAmount > 0 ? 'debit' : 'credit',
            line.mappingId,
          ])
        }
      }
    }

    if (config.includeAdjustingEntries && result.adjustingEntries) {
      for (const entry of result.adjustingEntries) {
        rows.push([
          'adjusting_entry',
          '',
          lang === 'en' ? (entry.descriptionEn ?? entry.description) : entry.description,
          entry.descriptionEn ?? '',
          '',
          '',
          entry.type,
          entry.ifrsReference ?? entry.usgaapReference ?? '',
        ])
      }
    }

    return rows.map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\n')
  }

  private generateFileName(context: ExporterContext): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = context.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `conversion_data_${safeName}_${dateStr}.csv`
  }

  private escapeCsvCell(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
}
