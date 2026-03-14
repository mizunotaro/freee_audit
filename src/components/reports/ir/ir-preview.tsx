'use client'

import * as React from 'react'
import { Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { IRReport, Language } from '@/types/reports/ir-report'

export interface IRPreviewProps {
  report: IRReport
  language: Language
  onPrint?: () => void
  onExport?: () => void
}

export function IRPreview({ report, language, onPrint, onExport }: IRPreviewProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
      return
    }
    window.print()
  }

  const handleExport = () => {
    if (onExport) {
      onExport()
      return
    }
  }

  const renderMarkdown = (markdown: string) => {
    const lines = markdown.split('\n')
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="mb-3 mt-6 text-xl font-bold text-primary">
            {line.replace('## ', '')}
          </h2>
        )
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={i} className="mb-2 mt-4 text-lg font-semibold">
            {line.replace('### ', '')}
          </h3>
        )
      }
      if (line.startsWith('- ')) {
        return (
          <li key={i} className="mb-1 ml-6">
            {line.replace('- ', '')}
          </li>
        )
      }
      if (line.match(/^\d+\.\s/)) {
        return (
          <li key={i} className="mb-1 ml-6 list-decimal">
            {line.replace(/^\d+\.\s/, '')}
          </li>
        )
      }
      if (line.trim() === '') {
        return <br key={i} />
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} className="mb-2 font-semibold">
            {line.replace(/\*\*/g, '')}
          </p>
        )
      }
      return (
        <p key={i} className="mb-2 leading-relaxed">
          {line}
        </p>
      )
    })
  }

  const getLocalizedTitle = (ja: string, en: string) => {
    if (language === 'ja') return ja
    if (language === 'en') return en
    return `${ja} / ${en}`
  }

  const sections = report.sections.sort((a, b) => a.order - b.order)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4 print:hidden">
        <h2 className="text-lg font-semibold">プレビュー</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            印刷
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            PDF出力
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-auto bg-white p-8 print:p-0">
        <div className="mx-auto max-w-[800px]">
          <header className="mb-8 border-b pb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold">
              {getLocalizedTitle(report.title.ja, report.title.en)}
            </h1>
            <p className="text-muted-foreground">
              {report.fiscalYear}{' '}
              {language === 'bilingual'
                ? '年度 / Fiscal Year'
                : language === 'ja'
                  ? '年度'
                  : 'Fiscal Year'}
            </p>
          </header>

          <div className="space-y-8">
            {sections.map((section) => {
              const sectionContent = section.content[language === 'bilingual' ? 'ja' : language]

              if (!sectionContent) return null

              return (
                <Card key={section.id} className="print:border-0 print:shadow-none">
                  <CardHeader className="print:pb-2">
                    <CardTitle className="text-xl">
                      {getLocalizedTitle(section.title.ja, section.title.en)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      {renderMarkdown(sectionContent)}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {report.financialHighlights.length > 0 && (
            <div className="mt-8">
              <Separator className="my-6" />
              <Card className="print:border-0 print:shadow-none">
                <CardHeader>
                  <CardTitle>
                    {language === 'en' ? 'Financial Highlights' : '財務ハイライト'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 text-left">{language === 'en' ? 'Item' : '項目'}</th>
                          {report.financialHighlights.map((h) => (
                            <th key={h.fiscalYear} className="py-2 text-right">
                              {h.fiscalYear}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2">{language === 'en' ? 'Revenue' : '売上高'}</td>
                          {report.financialHighlights.map((h) => (
                            <td key={h.fiscalYear} className="py-2 text-right">
                              {h.revenue.toLocaleString()}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">
                            {language === 'en' ? 'Operating Profit' : '営業利益'}
                          </td>
                          {report.financialHighlights.map((h) => (
                            <td key={h.fiscalYear} className="py-2 text-right">
                              {h.operatingProfit.toLocaleString()}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">
                            {language === 'en' ? 'Net Income' : '当期純利益'}
                          </td>
                          {report.financialHighlights.map((h) => (
                            <td key={h.fiscalYear} className="py-2 text-right">
                              {h.netIncome.toLocaleString()}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <footer className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
            <p>
              {language === 'en'
                ? `Published: ${report.metadata.publishedAt ? new Date(report.metadata.publishedAt).toLocaleDateString('en-US') : '-'}`
                : `公開日: ${report.metadata.publishedAt ? new Date(report.metadata.publishedAt).toLocaleDateString('ja-JP') : '-'}`}
            </p>
            <p className="mt-1">Version {report.metadata.version}</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default IRPreview
