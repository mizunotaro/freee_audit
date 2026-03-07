import type { Exporter, ExporterContext } from './types'
import type { ConversionResult, ExportConfig } from '@/types/conversion'

export class PDFExporter implements Exporter {
  async export(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const content = this.generateContent(result, config, context)

    const html = this.wrapInHTML(content, context, config)

    const buffer = Buffer.from(html, 'utf-8')
    const fileName = this.generateFileName(context, config)

    return {
      buffer,
      fileName,
      mimeType: 'text/html',
    }
  }

  private generateContent(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): string {
    const sections: string[] = []

    sections.push(this.generateHeader(context, config))

    if (config.includeFinancialStatements && result.balanceSheet) {
      sections.push(this.generateBalanceSheet(result.balanceSheet, config))
    }

    if (config.includeFinancialStatements && result.profitLoss) {
      sections.push(this.generateProfitLoss(result.profitLoss, config))
    }

    if (config.includeFinancialStatements && result.cashFlow) {
      sections.push(this.generateCashFlow(result.cashFlow, config))
    }

    if (config.includeAdjustingEntries && result.adjustingEntries?.length) {
      sections.push(this.generateAdjustingEntries(result.adjustingEntries, config))
    }

    if (config.includeDisclosures && result.disclosures?.length) {
      sections.push(this.generateDisclosures(result.disclosures, config))
    }

    if (result.warnings.length > 0) {
      sections.push(this.generateWarnings(result.warnings))
    }

    return sections.join('\n')
  }

  private generateHeader(context: ExporterContext, config: ExportConfig): string {
    const lang = config.language === 'en' ? 'en' : 'ja'
    const title =
      lang === 'en'
        ? `${context.sourceStandard} to ${context.targetStandard} Conversion Report`
        : `${context.sourceStandard}から${context.targetStandard}への変換レポート`

    return `
      <header style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <h1>${this.escapeHtml(context.companyName)}</h1>
        <h2>${title}</h2>
        <p>${context.periodStart.toLocaleDateString()} - ${context.periodEnd.toLocaleDateString()}</p>
        <p><small>Generated: ${new Date().toLocaleString()}</small></p>
      </header>
    `
  }

  private generateBalanceSheet(
    bs: NonNullable<ConversionResult['balanceSheet']>,
    config: ExportConfig
  ): string {
    const lang = config.language === 'en' ? 'en' : 'ja'

    return `
      <section style="margin-bottom: 30px;">
        <h3>${lang === 'en' ? 'Balance Sheet' : '貸借対照表'}</h3>
        <p><small>As of: ${bs.asOfDate.toLocaleDateString()}</small></p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${lang === 'en' ? 'Account' : '科目'}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${lang === 'en' ? 'Amount' : '金額'}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="2" style="border: 1px solid #ddd; padding: 8px; background-color: #e8e8e8; font-weight: bold;">${lang === 'en' ? 'Assets' : '資産'}</td></tr>
            ${bs.assets
              .map(
                (a) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${this.escapeHtml(lang === 'en' ? a.nameEn : a.name)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${a.amount.toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Total Assets' : '資産合計'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${bs.totalAssets.toLocaleString()}</td>
            </tr>
            
            <tr><td colspan="2" style="border: 1px solid #ddd; padding: 8px; background-color: #e8e8e8; font-weight: bold;">${lang === 'en' ? 'Liabilities' : '負債'}</td></tr>
            ${bs.liabilities
              .map(
                (l) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${this.escapeHtml(lang === 'en' ? l.nameEn : l.name)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${l.amount.toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Total Liabilities' : '負債合計'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${bs.totalLiabilities.toLocaleString()}</td>
            </tr>
            
            <tr><td colspan="2" style="border: 1px solid #ddd; padding: 8px; background-color: #e8e8e8; font-weight: bold;">${lang === 'en' ? 'Equity' : '株主資本'}</td></tr>
            ${bs.equity
              .map(
                (e) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${this.escapeHtml(lang === 'en' ? e.nameEn : e.name)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${e.amount.toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Total Equity' : '株主資本合計'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${bs.totalEquity.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `
  }

  private generateProfitLoss(
    pl: NonNullable<ConversionResult['profitLoss']>,
    config: ExportConfig
  ): string {
    const lang = config.language === 'en' ? 'en' : 'ja'

    return `
      <section style="margin-bottom: 30px;">
        <h3>${lang === 'en' ? 'Profit and Loss Statement' : '損益計算書'}</h3>
        <p><small>${pl.periodStart.toLocaleDateString()} - ${pl.periodEnd.toLocaleDateString()}</small></p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tbody>
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Revenue' : '売上高'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${pl.revenue.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Gross Profit' : '売上総利益'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${pl.grossProfit.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Operating Income' : '営業利益'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${pl.operatingIncome.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Ordinary Income' : '経常利益'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${pl.ordinaryIncome.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold; background-color: #e8e8e8;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Net Income' : '当期純利益'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${pl.netIncome.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `
  }

  private generateCashFlow(
    cf: NonNullable<ConversionResult['cashFlow']>,
    config: ExportConfig
  ): string {
    const lang = config.language === 'en' ? 'en' : 'ja'

    return `
      <section style="margin-bottom: 30px;">
        <h3>${lang === 'en' ? 'Cash Flow Statement' : 'キャッシュフロー計算書'}</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tbody>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Net Cash from Operating Activities' : '営業活動によるキャッシュフロー'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cf.netCashFromOperating.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Net Cash from Investing Activities' : '投資活動によるキャッシュフロー'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cf.netCashFromInvesting.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Net Cash from Financing Activities' : '財務活動によるキャッシュフロー'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cf.netCashFromFinancing.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: bold; background-color: #e8e8e8;">
              <td style="border: 1px solid #ddd; padding: 8px;">${lang === 'en' ? 'Net Change in Cash' : '現金同等物の純増減'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cf.netChangeInCash.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `
  }

  private generateAdjustingEntries(
    entries: NonNullable<ConversionResult['adjustingEntries']>,
    config: ExportConfig
  ): string {
    const lang = config.language === 'en' ? 'en' : 'ja'

    return `
      <section style="margin-bottom: 30px;">
        <h3>${lang === 'en' ? 'Adjusting Entries' : '調整仕訳'}</h3>
        
        ${entries
          .map(
            (entry) => `
          <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px;">
            <h4>${this.escapeHtml(lang === 'en' ? (entry.descriptionEn ?? entry.description) : entry.description)}</h4>
            <p><small>Type: ${entry.type}</small></p>
            ${entry.ifrsReference ? `<p><small>IFRS Reference: ${this.escapeHtml(entry.ifrsReference)}</small></p>` : ''}
            ${entry.usgaapReference ? `<p><small>USGAAP Reference: ${this.escapeHtml(entry.usgaapReference)}</small></p>` : ''}
            ${entry.aiSuggested ? '<p><small style="color: #666;">AI Suggested</small></p>' : ''}
          </div>
        `
          )
          .join('')}
      </section>
    `
  }

  private generateDisclosures(
    disclosures: NonNullable<ConversionResult['disclosures']>,
    config: ExportConfig
  ): string {
    const lang = config.language === 'en' ? 'en' : 'ja'

    return `
      <section style="margin-bottom: 30px;">
        <h3>${lang === 'en' ? 'Disclosure Notes' : '開示注記'}</h3>
        
        ${disclosures
          .map(
            (d) => `
          <div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
            <h4>${this.escapeHtml(lang === 'en' ? d.titleEn : d.title)}</h4>
            <p style="white-space: pre-wrap;">${this.escapeHtml(lang === 'en' ? (d.contentEn ?? d.content) : d.content)}</p>
            <p><small>Reference: ${this.escapeHtml(d.standardReference)}</small></p>
          </div>
        `
          )
          .join('')}
      </section>
    `
  }

  private generateWarnings(warnings: ConversionResult['warnings']): string {
    return `
      <section style="margin-bottom: 30px;">
        <h3>Warnings</h3>
        <ul>
          ${warnings.map((w) => `<li>${this.escapeHtml(w.message)} (${w.code})</li>`).join('')}
        </ul>
      </section>
    `
  }

  private wrapInHTML(content: string, context: ExporterContext, config: ExportConfig): string {
    const lang = config.language === 'en' ? 'en' : 'ja'
    const title =
      lang === 'en'
        ? `${context.sourceStandard} to ${context.targetStandard} Conversion Report - ${context.companyName}`
        : `${context.companyName} - ${context.sourceStandard}から${context.targetStandard}への変換レポート`

    return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    @media print {
      body { padding: 0; }
      section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${content}
  
  <footer style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; text-align: center; color: #666; font-size: 12px;">
    <p>Generated by freee_audit Conversion System</p>
    <p>Conversion Duration: ${context.periodStart.toLocaleDateString()} - ${context.periodEnd.toLocaleDateString()}</p>
  </footer>
</body>
</html>
    `
  }

  private generateFileName(context: ExporterContext, _config: ExportConfig): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = context.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `conversion_${safeName}_${dateStr}.html`
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
