'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'

export interface ReceiptUploaderProps {
  onUpload: (file: File) => Promise<void>
  isProcessing?: boolean
  className?: string
}

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(file: File): FileValidationResult {
  const { maxFileSize, acceptedTypes } = JOURNAL_PROPOSAL_CONFIG.upload

  if (!(acceptedTypes as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Accepted: ${acceptedTypes.join(', ')}`,
    }
  }

  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxFileSize / 1024 / 1024}MB limit`,
    }
  }

  return { valid: true }
}

export function ReceiptUploader({
  onUpload,
  isProcessing = false,
  className,
}: ReceiptUploaderProps) {
  const t = useTranslations('journalProposal.upload')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const validation = validateFile(file)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }

      setError(null)
      setUploadProgress(0)

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 100)

      try {
        await onUpload(file)
        setUploadProgress(100)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
        setUploadProgress(0)
      } finally {
        clearInterval(progressInterval)
      }
    },
    [onUpload]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const acceptedTypes = JOURNAL_PROPOSAL_CONFIG.upload.acceptedTypes.join(',')

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            isProcessing && 'pointer-events-none opacity-50'
          )}
        >
          <input
            type="file"
            accept={acceptedTypes}
            onChange={handleInputChange}
            disabled={isProcessing}
            className="hidden"
            id="receipt-upload"
            aria-label="Upload receipt file"
          />
          <label htmlFor="receipt-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="h-12 w-12 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm font-medium">{t('dragDrop')}</p>
              <p className="text-xs text-muted-foreground">{t('orClick')}</p>
              <p className="text-xs text-muted-foreground">{t('supportedFormats')}</p>
            </div>
          </label>
        </div>

        {isProcessing && (
          <div
            className="mt-4 space-y-2"
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="flex justify-between text-sm">
              <span>{t('processing')}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
