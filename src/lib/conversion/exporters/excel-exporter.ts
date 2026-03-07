import type { Exporter, ExporterContext } from './types'
import type { ConversionResult, ExportConfig } from '@/types/conversion'

export class ExcelExporter implements Exporter {
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
    context: ExporterContext
  ): string {
    const sections: string[] = []
    const lang = config.language === 'en' ? 'en' : 'ja'

    sections.push(
      `"${lang === 'en' ? 'Conversion Report' : '変換レポート'}: ${this.escapeCsv(context.companyName)}"`
    )
    sections.push(
      `"${lang === 'en' ? 'Period' : '期間'}: ${context.periodStart.toLocaleDateString()} - ${context.periodEnd.toLocaleDateString()}"`
    )
    sections.push('')

    if (config.includeFinancialStatements && result.balanceSheet) {
      sections.push(`"${lang === 'en' ? 'Balance Sheet' : '貸借対照表'}"`)
      sections.push(
        `"${lang === 'en' ? 'Account' : '科目'}","${lang === 'en' ? 'Amount' : '金額'}"`
      )

      sections.push(`"${lang === 'en' ? 'Assets' : '資産'}"`)
      for (const a of result.balanceSheet.assets) {
        sections.push(`"${this.escapeCsv(lang === 'en' ? a.nameEn : a.name)}",${a.amount}`)
      }
      sections.push(
        `"${lang === 'en' ? 'Total Assets' : '資産合計'}",${result.balanceSheet.totalAssets}`
      )
      sections.push('')

      sections.push(`"${lang === 'en' ? 'Liabilities' : '負債'}"`)
      for (const l of result.balanceSheet.liabilities) {
        sections.push(`"${this.escapeCsv(lang === 'en' ? l.nameEn : l.name)}",${l.amount}`)
      }
      sections.push(
        `"${lang === 'en' ? 'Total Liabilities' : '負債合計'}",${result.balanceSheet.totalLiabilities}`
      )
      sections.push('')

      sections.push(`"${lang === 'en' ? 'Equity' : '株主資本'}"`)
      for (const e of result.balanceSheet.equity) {
        sections.push(`"${this.escapeCsv(lang === 'en' ? e.nameEn : e.name)}",${e.amount}`)
      }
      sections.push(
        `"${lang === 'en' ? 'Total Equity' : '株主資本合計'}",${result.balanceSheet.totalEquity}`
      )
      sections.push('')
    }

    if (config.includeFinancialStatements && result.profitLoss) {
      sections.push(`"${lang === 'en' ? 'Profit and Loss Statement' : '損益計算書'}"`)
      sections.push(`"${lang === 'en' ? 'Item' : '項目'}","${lang === 'en' ? 'Amount' : '金額'}"`)
      sections.push(
        `"${lang === 'en' ? 'Gross Profit' : '売上総利益'}",${result.profitLoss.grossProfit}`
      )
      sections.push(
        `"${lang === 'en' ? 'Operating Income' : '営業利益'}",${result.profitLoss.operatingIncome}`
      )
      sections.push(
        `"${lang === 'en' ? 'Ordinary Income' : '経常利益'}",${result.profitLoss.ordinaryIncome}`
      )
      sections.push(
        `"${lang === 'en' ? 'Net Income' : '当期純利益'}",${result.profitLoss.netIncome}`
      )
      sections.push('')
    }

    if (config.includeJournals && result.journalConversions?.length) {
      sections.push(`"${lang === 'en' ? 'Journal Conversions' : '仕訳変換'}"`)
      sections.push(
        `"${lang === 'en' ? 'Source Account' : 'ソース科目'}","${lang === 'en' ? 'Target Account' : 'ターゲット科目'}","${lang === 'en' ? 'Debit' : '借方'}","${lang === 'en' ? 'Credit' : '貸方'}"`
      )

      for (const jc of result.journalConversions) {
        for (const line of jc.lines) {
          sections.push(
            `"${this.escapeCsv(line.sourceAccountName)}","${this.escapeCsv(line.targetAccountName)}",${line.debitAmount},${line.creditAmount}`
          )
        }
      }
      sections.push('')
    }

    if (config.includeAdjustingEntries && result.adjustingEntries?.length) {
      sections.push(`"${lang === 'en' ? 'Adjusting Entries' : '調整仕訳'}"`)
      sections.push(
        `"${lang === 'en' ? 'Type' : 'タイプ'}","${lang === 'en' ? 'Description' : '説明'}","${lang === 'en' ? 'Reference' : '参照'}"`
      )

      for (const entry of result.adjustingEntries) {
        const ref = entry.ifrsReference ?? entry.usgaapReference ?? ''
        sections.push(
          `"${entry.type}","${this.escapeCsv(lang === 'en' ? (entry.descriptionEn ?? entry.description) : entry.description)}","${this.escapeCsv(ref)}"`
        )
      }
      sections.push('')
    }

    return sections.join('\n')
  }

  private generateFileName(context: ExporterContext): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = context.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `conversion_${safeName}_${dateStr}.csv`
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return value.replace(/"/g, '""')
    }
    return value
  }
}
