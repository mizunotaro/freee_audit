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
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  SkipForward,
} from 'lucide-react'
import type { ImportResultData, ImportErrorUI } from './types'

interface ImportResultProps {
  result: ImportResultData
  onDismiss?: () => void
}

const MAX_DISPLAY_ERRORS = 20

function StatusBadge({ status }: { status: ImportResultData['status'] }) {
  const t = useTranslations('import')
  const config = {
    completed: { labelKey: 'statusCompleted', variant: 'default' as const, icon: CheckCircle2 },
    partial: { labelKey: 'statusPartial', variant: 'secondary' as const, icon: AlertTriangle },
    failed: { labelKey: 'statusFailed', variant: 'destructive' as const, icon: XCircle },
    pending: { labelKey: 'statusPending', variant: 'outline' as const, icon: Clock },
    parsing: { labelKey: 'statusParsing', variant: 'outline' as const, icon: FileSpreadsheet },
    validating: {
      labelKey: 'statusValidating',
      variant: 'outline' as const,
      icon: FileSpreadsheet,
    },
    previewing: {
      labelKey: 'statusPreviewing',
      variant: 'outline' as const,
      icon: FileSpreadsheet,
    },
    importing: { labelKey: 'statusImporting', variant: 'outline' as const, icon: FileSpreadsheet },
  }

  const { labelKey, variant, icon: Icon } = config[status] || config.pending

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </Badge>
  )
}

function ErrorTable({ errors }: { errors: ImportErrorUI[] }) {
  const t = useTranslations('import')
  if (errors.length === 0) return null

  const displayErrors = errors.slice(0, MAX_DISPLAY_ERRORS)
  const remaining = errors.length - MAX_DISPLAY_ERRORS

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('errorDetailsTitle')}</h4>
        <span className="text-xs text-muted-foreground">
          {t('showingErrorsOf', { total: errors.length, shown: displayErrors.length })}
        </span>
      </div>
      <ScrollArea className="h-[200px] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-16">{t('colRow')}</TableHead>
              <TableHead className="w-24">{t('colField')}</TableHead>
              <TableHead>{t('colMessage')}</TableHead>
              <TableHead className="w-24">{t('colValue')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayErrors.map((err, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-xs">{err.row}</TableCell>
                <TableCell className="text-xs">{err.field || '-'}</TableCell>
                <TableCell className="text-xs">{err.message}</TableCell>
                <TableCell className="max-w-[150px] truncate font-mono text-xs">
                  {err.value !== undefined ? String(err.value) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      {remaining > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('moreErrors', { count: remaining })}
        </p>
      )}
    </div>
  )
}

export function ImportResult({ result }: ImportResultProps) {
  const t = useTranslations('import')
  const { status, imported, skipped, failed, errors, warnings, totalRows, validRows, durationMs } =
    result

  const stats = useMemo(() => {
    const successRate = totalRows > 0 ? (imported / totalRows) * 100 : 0
    const skipRate = totalRows > 0 ? (skipped / totalRows) * 100 : 0
    const failRate = totalRows > 0 ? (failed / totalRows) * 100 : 0

    return { successRate, skipRate, failRate }
  }, [imported, skipped, failed, totalRows])

  const isComplete = status === 'completed'
  const isPartial = status === 'partial'
  const isFailed = status === 'failed'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t('resultTitle')}</CardTitle>
            <CardDescription>
              {isComplete && t('descCompleted')}
              {isPartial && t('descPartial')}
              {isFailed && t('descFailed')}
            </CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {t('statTotal')}
            </div>
            <p className="mt-1 text-2xl font-bold">{totalRows}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {t('statImported')}
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">{imported}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SkipForward className="h-4 w-4 text-yellow-500" />
              {t('statSkipped')}
            </div>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{skipped}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4 text-red-500" />
              {t('statFailed')}
            </div>
            <p className="mt-1 text-2xl font-bold text-red-600">{failed}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{t('progressLabel')}</span>
            <span className="text-muted-foreground">
              {t('validRows', { valid: validRows, total: totalRows })}
            </span>
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={validRows}
            aria-valuemin={0}
            aria-valuemax={totalRows}
            aria-label={t('progressAria')}
          >
            {stats.successRate > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${stats.successRate}%` }}
                title={t('tooltipSuccess', { count: imported })}
              />
            )}
            {stats.skipRate > 0 && (
              <div
                className="bg-yellow-500"
                style={{ width: `${stats.skipRate}%` }}
                title={t('tooltipSkip', { count: skipped })}
              />
            )}
            {stats.failRate > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${stats.failRate}%` }}
                title={t('tooltipFailed', { count: failed })}
              />
            )}
          </div>
        </div>

        {durationMs !== undefined && (
          <p className="text-right text-xs text-muted-foreground">
            {t('durationLabel')}
            {durationMs < 1000
              ? t('durationMs', { ms: durationMs })
              : t('durationSeconds', { s: (durationMs / 1000).toFixed(2) })}
          </p>
        )}

        {isFailed && errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('failedAlertTitle')}</AlertTitle>
            <AlertDescription>{t('failedAlertDesc')}</AlertDescription>
          </Alert>
        )}

        {isPartial && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('partialAlertTitle')}</AlertTitle>
            <AlertDescription>{t('partialAlertDesc', { count: failed })}</AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <h4 className="mb-2 text-sm font-medium text-yellow-800">
              {t('warningsTitle', { count: warnings.length })}
            </h4>
            <ul className="space-y-1 text-xs text-yellow-700">
              {warnings.slice(0, 5).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
              {warnings.length > 5 && <li>{t('moreCount', { count: warnings.length - 5 })}</li>}
            </ul>
          </div>
        )}

        {errors.length > 0 && <ErrorTable errors={errors} />}
      </CardContent>
    </Card>
  )
}
