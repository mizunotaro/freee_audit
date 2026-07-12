'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2, Info, Languages } from 'lucide-react'
import type { ImportPreviewData, ImportErrorUI } from './types'

interface ImportPreviewProps {
  preview: ImportPreviewData
  maxPreviewRows?: number
}

const MAX_DISPLAY_ERRORS = 5

function ErrorList({ errors }: { errors: ImportErrorUI[] }) {
  const t = useTranslations('import')
  if (errors.length === 0) return null

  const displayErrors = errors.slice(0, MAX_DISPLAY_ERRORS)
  const remaining = errors.length - MAX_DISPLAY_ERRORS

  return (
    <div className="mt-3 space-y-1">
      <p className="text-sm font-medium text-destructive">
        {t('errorListCount', { label: t('errorLabel'), count: errors.length })}
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {displayErrors.map((err, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="shrink-0 rounded bg-destructive/10 px-1 text-destructive">
              {t('rowPrefix', { row: err.row })}
            </span>
            <span>{err.message}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-muted-foreground">{t('moreCount', { count: remaining })}</li>
        )}
      </ul>
    </div>
  )
}

export function ImportPreview({ preview, maxPreviewRows = 10 }: ImportPreviewProps) {
  const t = useTranslations('import')
  const { headers, rows, totalRows, detectedLanguage, warnings, sampleErrors } = preview

  const displayRows = useMemo(() => rows.slice(0, maxPreviewRows), [rows, maxPreviewRows])

  const errorCount = sampleErrors.filter((e) => e.severity === 'error').length
  const warningCount = sampleErrors.filter((e) => e.severity === 'warning').length + warnings.length
  const hasErrors = errorCount > 0
  const hasWarnings = warningCount > 0

  const languageLabel =
    detectedLanguage === 'ja'
      ? t('langJa')
      : detectedLanguage === 'en'
        ? t('langEn')
        : t('langUnknown')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t('previewTitle')}</CardTitle>
            <CardDescription>{t('previewDescription')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Languages className="h-3 w-3" />
              {languageLabel}
            </Badge>
            <Badge variant="secondary">{t('rowCount', { count: totalRows })}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('hasErrorsTitle')}</AlertTitle>
            <AlertDescription>
              {t('hasErrorsDesc')}
              <ErrorList errors={sampleErrors.filter((e) => e.severity === 'error')} />
            </AlertDescription>
          </Alert>
        )}

        {hasWarnings && !hasErrors && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('hasWarningsTitle')}</AlertTitle>
            <AlertDescription>
              {t('hasWarningsDesc')}
              {warnings.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {warnings.slice(0, 3).map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                  {warnings.length > 3 && <li>{t('moreCount', { count: warnings.length - 3 })}</li>}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {!hasErrors && !hasWarnings && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>{t('dataValidTitle')}</AlertTitle>
            <AlertDescription>{t('dataValidDesc')}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-12 bg-background">#</TableHead>
                  {headers.map((header, idx) => (
                    <TableHead key={idx} className="bg-background">
                      {header}
                      {preview.mappedHeaders[header] &&
                        preview.mappedHeaders[header] !== header && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            → {preview.mappedHeaders[header]}
                          </span>
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row, rowIdx) => {
                  const rowErrors = sampleErrors.filter((e) => e.row === rowIdx + 2)
                  const hasRowError = rowErrors.length > 0

                  return (
                    <TableRow key={rowIdx} className={hasRowError ? 'bg-destructive/5' : undefined}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rowIdx + 2}
                      </TableCell>
                      {headers.map((header, colIdx) => {
                        const cellError = rowErrors.find((e) => e.field === header)
                        const value = row[preview.mappedHeaders[header] || header]

                        return (
                          <TableCell
                            key={colIdx}
                            className={cellError ? 'text-destructive' : undefined}
                            title={cellError?.message}
                          >
                            {String(value ?? '')}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {totalRows > maxPreviewRows && (
          <p className="text-center text-sm text-muted-foreground">
            {t('showingFirst', { shown: maxPreviewRows, total: totalRows })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
