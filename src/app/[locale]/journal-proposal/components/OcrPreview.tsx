'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfidenceIndicator } from '@/components/journal-proposal'
import type { OCRAnalysisResult } from '@/types/journal-proposal'

interface OcrPreviewProps {
  ocrResult: OCRAnalysisResult
  className?: string
}

export function OcrPreview({ ocrResult, className }: OcrPreviewProps) {
  const t = useTranslations('journalProposal.ocr')
  const { rawText, extractedInfo, confidence, warnings } = ocrResult

  const highlightKeywords = (text: string): React.ReactNode => {
    const patterns = [
      { regex: /¥[\d,]+/g, className: 'text-green-600 font-medium' },
      { regex: /\d{4}[-/]\d{2}[-/]\d{2}/g, className: 'text-blue-600 font-medium' },
      { regex: /\d{1,3}(,\d{3})*円/g, className: 'text-green-600 font-medium' },
      { regex: /10%|8%|消費税/g, className: 'text-orange-600 font-medium' },
    ]

    let result: React.ReactNode = text
    patterns.forEach(({ regex, className: cls }) => {
      result = highlightPattern(result, regex, cls)
    })
    return result
  }

  const highlightPattern = (
    input: React.ReactNode,
    regex: RegExp,
    className: string
  ): React.ReactNode => {
    if (typeof input === 'string') {
      const parts = input.split(regex)
      const matches = input.match(regex) || []
      return parts.reduce<React.ReactNode[]>((acc, part, i) => {
        acc.push(part)
        if (matches[i]) {
          acc.push(
            <span key={i} className={className}>
              {matches[i]}
            </span>
          )
        }
        return acc
      }, [])
    }
    return input
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('title')}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('confidence')}:</span>
            <ConfidenceIndicator confidence={confidence} size="sm" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium">{t('extractedInfo')}</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {extractedInfo.date && (
              <div className="flex justify-between rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">{t('date')}</span>
                <span className="font-medium">{extractedInfo.date}</span>
              </div>
            )}
            {extractedInfo.vendorName && (
              <div className="flex justify-between rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">{t('vendor')}</span>
                <span className="font-medium">{extractedInfo.vendorName}</span>
              </div>
            )}
            {extractedInfo.totalAmount !== undefined && (
              <div className="flex justify-between rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">{t('amount')}</span>
                <span className="font-medium">¥{extractedInfo.totalAmount.toLocaleString()}</span>
              </div>
            )}
            {extractedInfo.taxAmount !== undefined && (
              <div className="flex justify-between rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">{t('taxAmount')}</span>
                <span className="font-medium">¥{extractedInfo.taxAmount.toLocaleString()}</span>
              </div>
            )}
            {extractedInfo.taxRate !== undefined && (
              <div className="flex justify-between rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">{t('taxRate')}</span>
                <span className="font-medium">{(extractedInfo.taxRate * 100).toFixed(0)}%</span>
              </div>
            )}
            {extractedInfo.paymentMethod && (
              <div className="flex justify-between rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">{t('paymentMethod')}</span>
                <span className="font-medium">{extractedInfo.paymentMethod}</span>
              </div>
            )}
          </div>
        </div>

        {extractedInfo.items && extractedInfo.items.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">{t('items')}</h4>
            <div className="space-y-1">
              {extractedInfo.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between rounded bg-muted/30 px-2 py-1 text-sm"
                >
                  <span>{item.name}</span>
                  {item.amount !== undefined && (
                    <span className="font-medium">¥{item.amount.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-medium">{t('rawText')}</h4>
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-3 font-mono text-xs">
            {highlightKeywords(rawText)}
          </div>
        </div>

        {warnings.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-amber-600">{t('warnings')}</h4>
            <div className="space-y-1">
              {warnings.map((warning, index) => (
                <Badge key={index} variant="outline" className="mb-1 mr-1 text-xs">
                  {warning}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
