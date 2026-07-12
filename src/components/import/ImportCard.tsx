'use client'

import { useState, useCallback, useRef, useReducer } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Upload, FileSpreadsheet, Download, X, Loader2, AlertCircle, Eye, Play } from 'lucide-react'
import { ImportPreview } from './ImportPreview'
import { ImportResult } from './ImportResult'
import {
  type ImportPreviewData,
  type ImportResultData,
  type ImportState,
  type ImportOptions,
  DEFAULT_UI_IMPORT_OPTIONS,
  IMPORT_TYPE_LABELS,
  IMPORT_TYPE_DESCRIPTIONS,
  MAX_FILE_SIZE_MB,
} from './types'
import type { ImportType } from '@/services/import/types'

const ACCEPTED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'xlsm']

type ImportAction =
  | { type: 'SET_FILE'; payload: File | null }
  | { type: 'SET_PREVIEW'; payload: ImportPreviewData }
  | { type: 'SET_RESULT'; payload: ImportResultData }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_STEP'; payload: ImportState['step'] }
  | { type: 'RESET' }

const initialImportState: ImportState = {
  step: 'upload',
  file: null,
  preview: null,
  result: null,
  error: null,
}

function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...state,
        file: action.payload,
        step: 'upload',
        preview: null,
        result: null,
        error: null,
      }
    case 'SET_PREVIEW':
      return { ...state, preview: action.payload, step: 'preview', error: null }
    case 'SET_RESULT':
      return { ...state, result: action.payload, step: 'result', error: null }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_STEP':
      return { ...state, step: action.payload }
    case 'RESET':
      return initialImportState
    default:
      return state
  }
}

interface ImportCardProps {
  type: ImportType
  apiEndpoint: string
  companyId: string
  onComplete?: (result: ImportResultData) => void
  onError?: (error: string) => void
}

const REQUEST_TIMEOUT_MS = 120000

export function ImportCard({ type, apiEndpoint, companyId, onComplete, onError }: ImportCardProps) {
  const t = useTranslations('import')
  const locale = useLocale() as 'ja' | 'en'
  const [state, dispatch] = useReducer(importReducer, initialImportState)
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_UI_IMPORT_OPTIONS)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const typeLabel = IMPORT_TYPE_LABELS[type][locale]
  const typeDescription = IMPORT_TYPE_DESCRIPTIONS[type][locale]

  const validateFile = useCallback(
    (file: File): string | null => {
      const extension = file.name.toLowerCase().split('.').pop()

      if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
        return t('errUnsupportedFormat', { formats: ACCEPTED_EXTENSIONS.join(', ') })
      }

      const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024
      if (file.size > maxSizeBytes) {
        return t('errFileTooLarge', { max: MAX_FILE_SIZE_MB })
      }

      return null
    },
    [t]
  )

  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        dispatch({ type: 'SET_ERROR', payload: validationError })
        onError?.(validationError)
        return
      }
      dispatch({ type: 'SET_FILE', payload: file })
    },
    [validateFile, onError]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDropzoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }, [])

  const handlePreview = useCallback(async () => {
    if (!state.file) return

    setIsUploading(true)
    setUploadProgress(0)
    dispatch({ type: 'SET_ERROR', payload: null })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('mode', 'preview')

      const response = await fetch(`${apiEndpoint}?companyId=${companyId}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      setUploadProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('errPreviewFailed'))
      }

      dispatch({ type: 'SET_PREVIEW', payload: data.preview as ImportPreviewData })
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? t('errRequestTimeout')
          : error instanceof Error
            ? error.message
            : t('errUnknown')

      dispatch({ type: 'SET_ERROR', payload: message })
      onError?.(message)
    } finally {
      clearTimeout(timeoutId)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [state.file, apiEndpoint, companyId, onError, t])

  const handleImport = useCallback(async () => {
    if (!state.file) return

    setIsUploading(true)
    setUploadProgress(0)
    dispatch({ type: 'SET_STEP', payload: 'importing' })
    dispatch({ type: 'SET_ERROR', payload: null })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('skipDuplicates', String(options.skipDuplicates))
      formData.append('updateExisting', String(options.updateExisting))
      formData.append('dryRun', String(options.dryRun))

      const response = await fetch(`${apiEndpoint}?companyId=${companyId}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      setUploadProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('errImportFailed'))
      }

      dispatch({ type: 'SET_RESULT', payload: data as ImportResultData })
      onComplete?.(data as ImportResultData)
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? t('errRequestTimeout')
          : error instanceof Error
            ? error.message
            : t('errUnknown')

      dispatch({ type: 'SET_ERROR', payload: message })
      dispatch({ type: 'SET_STEP', payload: 'preview' })
      onError?.(message)
    } finally {
      clearTimeout(timeoutId)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [state.file, options, apiEndpoint, companyId, onComplete, onError, t])

  const handleDownloadTemplate = useCallback(() => {
    window.location.href = `${apiEndpoint}?action=template&language=${options.language}`
  }, [apiEndpoint, options.language])

  const handleClear = useCallback(() => {
    dispatch({ type: 'RESET' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleBackToUpload = useCallback(() => {
    dispatch({ type: 'SET_STEP', payload: 'upload' })
    dispatch({ type: 'SET_PREVIEW', payload: null as unknown as ImportPreviewData })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cardTitle', { type: typeLabel })}</CardTitle>
        <CardDescription>{typeDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('errorTitle')}</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              {state.error}
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('btnCloseErrorAria')}
                onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.step === 'upload' && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={handleDropzoneKeyDown}
              role="button"
              tabIndex={0}
              aria-label={t('selectFileAria', { type: typeLabel })}
              className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                state.file
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
                onChange={handleFileChange}
                onClick={(e) => e.stopPropagation()}
                className="hidden"
              />
              {state.file ? (
                <div className="text-center">
                  <FileSpreadsheet className="mx-auto mb-2 h-12 w-12 text-green-600" />
                  <p className="text-lg font-medium text-green-700">{state.file.name}</p>
                  <p className="text-sm text-gray-500">{(state.file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                  <p className="mb-1 text-lg font-medium text-gray-600">{t('dropHint')}</p>
                  <p className="text-sm text-gray-500">{t('clickToSelect')}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {t('acceptedFormats', { max: MAX_FILE_SIZE_MB })}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg bg-gray-50 p-4">
              <h4 className="font-medium">{t('optionsTitle')}</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="skipDuplicates" className="cursor-pointer">
                    {t('skipDuplicates')}
                  </Label>
                  <Switch
                    id="skipDuplicates"
                    checked={options.skipDuplicates}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, skipDuplicates: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="updateExisting" className="cursor-pointer">
                    {t('updateExisting')}
                  </Label>
                  <Switch
                    id="updateExisting"
                    checked={options.updateExisting}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, updateExisting: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dryRun" className="cursor-pointer">
                    {t('dryRun')}
                  </Label>
                  <Switch
                    id="dryRun"
                    checked={options.dryRun}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, dryRun: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handlePreview}
                disabled={!state.file || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('btnPreview')}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDownloadTemplate} disabled={isUploading}>
                <Download className="mr-2 h-4 w-4" />
                {t('btnTemplate')}
              </Button>
              {state.file && (
                <Button
                  variant="ghost"
                  aria-label={t('btnClearAria')}
                  onClick={handleClear}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}

        {state.step === 'preview' && state.preview && (
          <>
            <ImportPreview preview={state.preview} />

            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('processing')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={isUploading} className="flex-1">
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('importing')}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {t('btnRunImport')}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleBackToUpload} disabled={isUploading}>
                {t('btnBack')}
              </Button>
            </div>
          </>
        )}

        {state.step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">{t('importingStatus')}</p>
            <p className="text-sm text-muted-foreground">{t('pleaseWait')}</p>
            {uploadProgress > 0 && (
              <div className="mt-4 w-full max-w-xs">
                <Progress value={uploadProgress} />
              </div>
            )}
          </div>
        )}

        {state.step === 'result' && state.result && (
          <>
            <ImportResult result={state.result} />
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClear} className="flex-1">
                {t('btnNewImport')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
