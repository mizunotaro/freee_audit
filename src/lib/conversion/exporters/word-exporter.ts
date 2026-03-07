import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
  type ISectionOptions,
} from 'docx'
import type { Exporter, ExporterContext } from './types'
import type { ConversionResult, ExportConfig, DisclosureDocument } from '@/types/conversion'

export class WordExporter implements Exporter {
  async export(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const sections = this.buildSections(result, config, context)
    const doc = new Document({
      sections,
      styles: {
        default: {
          document: {
            run: {
              font: 'Calibri',
              size: 22,
            },
            paragraph: {
              spacing: {
                line: 276,
              },
            },
          },
        },
      },
    })

    const buffer = await Packer.toBuffer(doc)
    const fileName = this.generateFileName(context, config)

    return {
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  async exportDisclosures(
    disclosures: DisclosureDocument[],
    context: ExporterContext,
    config: ExportConfig
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const sections = this.buildDisclosureSections(disclosures, context, config)
    const doc = new Document({
      sections,
      styles: {
        default: {
          document: {
            run: {
              font: 'Calibri',
              size: 22,
            },
            paragraph: {
              spacing: {
                line: 276,
              },
            },
          },
        },
      },
    })

    const buffer = await Packer.toBuffer(doc)
    const fileName = this.generateDisclosureFileName(context, config)

    return {
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  private buildSections(
    result: ConversionResult,
    config: ExportConfig,
    context: ExporterContext
  ): ISectionOptions[] {
    const lang = config.language === 'en' ? 'en' : 'ja'
    const children: Paragraph[] = []

    children.push(this.createHeader(context, config, lang))

    if (config.includeFinancialStatements && result.balanceSheet) {
      children.push(...this.createBalanceSheet(result.balanceSheet, config, lang))
    }

    if (config.includeFinancialStatements && result.profitLoss) {
      children.push(...this.createProfitLoss(result.profitLoss, config, lang))
    }

    if (config.includeAdjustingEntries && result.adjustingEntries?.length) {
      children.push(...this.createAdjustingEntries(result.adjustingEntries, config, lang))
    }

    if (config.includeDisclosures && result.disclosures?.length) {
      children.push(...this.createDisclosures(result.disclosures, config, lang))
    }

    children.push(this.createFooter(context, config, lang))

    return [{ children }]
  }

  private buildDisclosureSections(
    disclosures: DisclosureDocument[],
    context: ExporterContext,
    config: ExportConfig
  ): ISectionOptions[] {
    const lang = config.language === 'en' ? 'en' : 'ja'
    const children: Paragraph[] = []

    children.push(this.createDisclosureHeader(context, config, lang))

    for (const disclosure of disclosures) {
      children.push(...this.createDisclosureSection(disclosure, lang))
    }

    children.push(this.createFooter(context, config, lang))

    return [{ children }]
  }

  private createHeader(
    context: ExporterContext,
    _config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph {
    const title =
      lang === 'en'
        ? `${context.sourceStandard} to ${context.targetStandard} Conversion Report`
        : `${context.sourceStandard}から${context.targetStandard}への変換レポート`

    return new Paragraph({
      children: [
        new TextRun({
          text: context.companyName,
          bold: true,
          size: 36,
        }),
        new TextRun({
          text: '',
          break: 1,
        }),
        new TextRun({
          text: title,
          bold: true,
          size: 28,
        }),
        new TextRun({
          text: '',
          break: 1,
        }),
        new TextRun({
          text: `${context.periodStart.toLocaleDateString()} - ${context.periodEnd.toLocaleDateString()}`,
          size: 22,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  }

  private createDisclosureHeader(
    context: ExporterContext,
    _config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph {
    const title = lang === 'en' ? 'Disclosure Documents' : '開示文書'

    return new Paragraph({
      children: [
        new TextRun({
          text: context.companyName,
          bold: true,
          size: 36,
        }),
        new TextRun({
          text: '',
          break: 1,
        }),
        new TextRun({
          text: title,
          bold: true,
          size: 28,
        }),
        new TextRun({
          text: '',
          break: 1,
        }),
        new TextRun({
          text: `${context.periodStart.toLocaleDateString()} - ${context.periodEnd.toLocaleDateString()}`,
          size: 22,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  }

  private createBalanceSheet(
    bs: NonNullable<ConversionResult['balanceSheet']>,
    config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang === 'en' ? 'Balance Sheet' : '貸借対照表',
            bold: true,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    )

    const rows = [
      this.createTableRow(
        [lang === 'en' ? 'Account' : '科目', lang === 'en' ? 'Amount' : '金額'],
        true
      ),
    ]

    for (const asset of bs.assets) {
      rows.push(
        this.createTableRow([
          lang === 'en' ? asset.nameEn : asset.name,
          asset.amount.toLocaleString(),
        ])
      )
    }

    rows.push(
      this.createTableRow(
        [lang === 'en' ? 'Total Assets' : '資産合計', bs.totalAssets.toLocaleString()],
        true
      )
    )

    for (const liability of bs.liabilities) {
      rows.push(
        this.createTableRow([
          lang === 'en' ? liability.nameEn : liability.name,
          liability.amount.toLocaleString(),
        ])
      )
    }

    rows.push(
      this.createTableRow(
        [lang === 'en' ? 'Total Liabilities' : '負債合計', bs.totalLiabilities.toLocaleString()],
        true
      )
    )

    for (const eq of bs.equity) {
      rows.push(
        this.createTableRow([lang === 'en' ? eq.nameEn : eq.name, eq.amount.toLocaleString()])
      )
    }

    rows.push(
      this.createTableRow(
        [lang === 'en' ? 'Total Equity' : '株主資本合計', bs.totalEquity.toLocaleString()],
        true
      )
    )

    const table = new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    })

    paragraphs.push(new Paragraph({ children: [table], spacing: { after: 300 } }))

    return paragraphs
  }

  private createProfitLoss(
    pl: NonNullable<ConversionResult['profitLoss']>,
    config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang === 'en' ? 'Profit and Loss Statement' : '損益計算書',
            bold: true,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    )

    const rows = [
      this.createTableRow(
        [lang === 'en' ? 'Item' : '項目', lang === 'en' ? 'Amount' : '金額'],
        true
      ),
      this.createTableRow([
        lang === 'en' ? 'Revenue' : '売上高',
        pl.revenue.reduce((sum, r) => sum + r.amount, 0).toLocaleString(),
      ]),
      this.createTableRow([
        lang === 'en' ? 'Gross Profit' : '売上総利益',
        pl.grossProfit.toLocaleString(),
      ]),
      this.createTableRow([
        lang === 'en' ? 'Operating Income' : '営業利益',
        pl.operatingIncome.toLocaleString(),
      ]),
      this.createTableRow([
        lang === 'en' ? 'Net Income' : '当期純利益',
        pl.netIncome.toLocaleString(),
      ]),
    ]

    const table = new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    })

    paragraphs.push(new Paragraph({ children: [table], spacing: { after: 300 } }))

    return paragraphs
  }

  private createAdjustingEntries(
    entries: NonNullable<ConversionResult['adjustingEntries']>,
    config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang === 'en' ? 'Adjusting Entries' : '調整仕訳',
            bold: true,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    )

    for (const entry of entries) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: lang === 'en' ? (entry.descriptionEn ?? entry.description) : entry.description,
              bold: true,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      )

      if (entry.ifrsReference) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `IFRS Reference: ${entry.ifrsReference}`,
                italics: true,
                size: 20,
              }),
            ],
          })
        )
      }

      if (entry.usgaapReference) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `USGAAP Reference: ${entry.usgaapReference}`,
                italics: true,
                size: 20,
              }),
            ],
          })
        )
      }
    }

    return paragraphs
  }

  private createDisclosures(
    disclosures: NonNullable<ConversionResult['disclosures']>,
    config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang === 'en' ? 'Disclosure Notes' : '開示注記',
            bold: true,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    )

    for (const d of disclosures) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: lang === 'en' ? d.titleEn : d.title,
              bold: true,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: lang === 'en' ? (d.contentEn ?? d.content) : d.content,
            }),
          ],
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Reference: ${d.standardReference}`,
              italics: true,
              size: 20,
            }),
          ],
          spacing: { after: 200 },
        })
      )
    }

    return paragraphs
  }

  private createDisclosureSection(disclosure: DisclosureDocument, lang: 'ja' | 'en'): Paragraph[] {
    const paragraphs: Paragraph[] = []

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang === 'en' ? disclosure.titleEn : disclosure.title,
            bold: true,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    )

    const content =
      lang === 'en' ? (disclosure.contentEn ?? disclosure.content) : disclosure.content
    const lines = content.split('\n')

    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
            }),
          ],
        })
      )
    }

    if (disclosure.standardReferences.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: lang === 'en' ? 'Standard References:' : '参照会計基準:',
              bold: true,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      )

      for (const ref of disclosure.standardReferences) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${ref.referenceNumber}: ${ref.title}`,
                italics: true,
                size: 20,
              }),
            ],
          })
        )
      }
    }

    return paragraphs
  }

  private createTableRow(cells: string[], bold = false): TableRow {
    return new TableRow({
      children: cells.map(
        (text, index) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text,
                    bold,
                  }),
                ],
                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
              }),
            ],
            width: { size: index === 0 ? 70 : 30, type: WidthType.PERCENTAGE },
          })
      ),
    })
  }

  private createFooter(
    context: ExporterContext,
    _config: ExportConfig,
    lang: 'ja' | 'en'
  ): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: '',
          break: 2,
        }),
        new TextRun({
          text:
            lang === 'en'
              ? 'Generated by freee_audit Conversion System'
              : 'freee_audit変換システムにより生成',
          size: 18,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  }

  private generateFileName(context: ExporterContext, _config: ExportConfig): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = context.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `conversion_${safeName}_${dateStr}.docx`
  }

  private generateDisclosureFileName(context: ExporterContext, _config: ExportConfig): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = context.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `disclosures_${safeName}_${dateStr}.docx`
  }
}
