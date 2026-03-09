'use client'

import { useState, useCallback } from 'react'

export type ExportFormat = 'pdf' | 'excel' | 'json'

export interface ExportOptions {
  format: ExportFormat
  includeCharts?: boolean
  includeRawData?: boolean
  language?: 'ja' | 'en'
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportAnalysis = useCallback(
    async (
      data: unknown,
      options: ExportOptions
    ): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> => {
      setIsExporting(true)
      setExportError(null)

      try {
        const bodyData =
          typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
        const response = await fetch('/api/analysis/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...bodyData,
            format: options.format === 'pdf' ? 'html' : options.format,
            options: {
              includeCharts: options.includeCharts,
              language: options.language,
            },
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message ?? 'Export failed')
        }

        if (options.format === 'json') {
          const jsonData = await response.json()
          const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
            type: 'application/json',
          })
          return {
            success: true,
            blob,
            filename: `financial-analysis-${Date.now()}.json`,
          }
        }

        const blob = await response.blob()
        const extension = options.format === 'pdf' ? 'pdf' : 'xlsx'

        return {
          success: true,
          blob,
          filename: `financial-analysis-${Date.now()}.${extension}`,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Export failed'
        setExportError(message)
        return { success: false, error: message }
      } finally {
        setIsExporting(false)
      }
    },
    []
  )

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return {
    isExporting,
    exportError,
    exportAnalysis,
    downloadBlob,
  }
}
