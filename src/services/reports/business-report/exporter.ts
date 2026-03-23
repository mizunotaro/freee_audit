import type {
  ExportOptions,
  KeidanrenBusinessReport,
  BusinessReportData,
} from '@/types/reports/business'

type AnyReport = KeidanrenBusinessReport | BusinessReportData

export interface ExportResult {
  success: boolean
  data?: Blob
  filename?: string
  error?: string
}

export class BusinessReportExporter {
  async export(report: AnyReport, options: ExportOptions): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'html':
          return this.exportHtml(report, options)
        case 'pdf':
          return this.exportPdf(report, options)
        case 'word':
          return this.exportWord(report, options)
        case 'xbrl':
          return this.exportXbrl(report, options)
        default:
          return { success: false, error: `Unsupported format: ${options.format}` }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' }
    }
  }

  private exportHtml(report: AnyReport, options: ExportOptions): ExportResult {
    const html = this.generateHtml(report, options)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const filename = this.generateFilename(report, 'html')
    return { success: true, data: blob, filename }
  }

  private exportPdf(_report: AnyReport, _options: ExportOptions): ExportResult {
    return {
      success: false,
      error: 'PDF export requires additional dependencies. Use HTML export instead.',
    }
  }

  private exportWord(_report: AnyReport, _options: ExportOptions): ExportResult {
    return {
      success: false,
      error: 'Word export requires additional dependencies. Use HTML export instead.',
    }
  }

  private exportXbrl(_report: AnyReport, _options: ExportOptions): ExportResult {
    return {
      success: false,
      error: 'XBRL export requires additional dependencies. Use HTML export instead.',
    }
  }

  private generateHtml(report: AnyReport, options: ExportOptions): string {
    const lang = options.language === 'en' ? 'en' : 'ja'
    const title = this.getReportTitle(report, lang)

    let sectionsHtml = ''
    if ('sections' in report && report.sections) {
      if (Array.isArray(report.sections)) {
        for (const section of report.sections) {
          if (section && typeof section === 'object' && 'content' in section) {
            sectionsHtml += `<section>\n<h2>${this.escapeHtml(section.title || '')}</h2>\n<div>${section.content || ''}</div>\n</section>\n`
          }
        }
      }
    }

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { border-bottom: 1px solid #666; margin-top: 30px; }
    section { margin-bottom: 30px; }
    .metadata { color: #666; font-size: 14px; margin-bottom: 20px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  <div class="metadata">
    ${this.escapeHtml(report.companyName || '')} | ${report.fiscalYear || ''}年度
  </div>
  ${sectionsHtml}
</body>
</html>`
  }

  private getReportTitle(_report: AnyReport, lang: string): string {
    if (lang === 'en') {
      return 'Business Report'
    }
    return '事業報告書'
  }

  private generateFilename(report: AnyReport, extension: string): string {
    const companyName = (report.companyName || 'company').replace(
      /[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
      '_'
    )
    const fiscalYear = report.fiscalYear || new Date().getFullYear()
    return `${companyName}_${fiscalYear}_business_report.${extension}`
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char] || char)
  }
}
