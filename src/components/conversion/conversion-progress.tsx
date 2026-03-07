'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type {
  ConversionProgress as ConversionProgressType,
  ConversionStatus,
  ConversionError,
} from '@/types/conversion'

interface ConversionProgressProps {
  projectId: string
  initialProgress?: ConversionProgressType
  onProgressUpdate?: (progress: ConversionProgressType) => void
  onComplete?: () => void
  onError?: (errors: ConversionError[]) => void
  pollInterval?: number
}

const STATUS_CONFIG: Record<
  ConversionStatus,
  {
    label: string
    labelEn: string
    icon: typeof CheckCircle2
    color: string
    bgColor: string
  }
> = {
  draft: {
    label: '下書き',
    labelEn: 'Draft',
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  mapping: {
    label: 'マッピング中',
    labelEn: 'Mapping',
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  validating: {
    label: '検証中',
    labelEn: 'Validating',
    icon: Loader2,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  converting: {
    label: '変換中',
    labelEn: 'Converting',
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  reviewing: {
    label: 'レビュー中',
    labelEn: 'Reviewing',
    icon: Clock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  completed: {
    label: '完了',
    labelEn: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  error: {
    label: 'エラー',
    labelEn: 'Error',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
}

export function ConversionProgress({
  projectId,
  initialProgress,
  onProgressUpdate,
  onComplete,
  onError,
  pollInterval = 2000,
}: ConversionProgressProps) {
  const [progress, setProgress] = useState<ConversionProgressType>(
    initialProgress || {
      status: 'draft',
      progress: 0,
      processedJournals: 0,
      totalJournals: 0,
      errors: [],
      startedAt: new Date(),
    }
  )
  const [isPolling, setIsPolling] = useState(false)

  const config = STATUS_CONFIG[progress.status]
  const Icon = config.icon
  const isActive = ['mapping', 'validating', 'converting'].includes(progress.status)

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversion/projects/${projectId}/progress`)
      if (response.ok) {
        const data = await response.json()
        setProgress(data.data)
        onProgressUpdate?.(data.data)

        if (data.data.status === 'completed') {
          setIsPolling(false)
          onComplete?.()
        }

        if (data.data.status === 'error') {
          setIsPolling(false)
          onError?.(data.data.errors)
        }
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error)
    }
  }, [projectId, onProgressUpdate, onComplete, onError])

  useEffect(() => {
    if (!isActive) return

    setIsPolling(true)

    const interval = setInterval(fetchProgress, pollInterval)

    return () => {
      clearInterval(interval)
      setIsPolling(false)
    }
  }, [isActive, pollInterval, fetchProgress])

  const startedAt = progress.startedAt ? new Date(progress.startedAt) : null
  const elapsedSeconds = startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0

  const estimatedCompletion = progress.estimatedCompletion
    ? new Date(progress.estimatedCompletion)
    : null
  const estimatedRemaining = estimatedCompletion
    ? Math.max(0, Math.floor((estimatedCompletion.getTime() - Date.now()) / 1000))
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-full p-2', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color, isActive && 'animate-spin')} />
          </div>
          <div>
            <p className="font-medium">{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.labelEn}</p>
          </div>
        </div>

        <Badge variant={progress.status === 'error' ? 'destructive' : 'secondary'}>
          {progress.progress.toFixed(1)}%
        </Badge>
      </div>

      <div className="space-y-2">
        <Progress value={progress.progress} className="h-2" />

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {progress.processedJournals.toLocaleString()} /{' '}
            {progress.totalJournals.toLocaleString()} 仕訳
          </span>
          <span>
            経過: {formatDuration(elapsedSeconds)}
            {estimatedRemaining !== null && ` / 残り: ${formatDuration(estimatedRemaining)}`}
          </span>
        </div>
      </div>

      {progress.currentItem && (
        <div className="truncate text-sm text-muted-foreground">処理中: {progress.currentItem}</div>
      )}

      {progress.errors && progress.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            エラー ({progress.errors.length}件)
          </p>
          <ScrollArea className="h-[100px] rounded border p-2">
            <ul className="space-y-1">
              {progress.errors.map((error, index) => (
                <li key={index} className="text-sm text-destructive">
                  {error.message}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      {isPolling && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>自動更新中...</span>
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  if (minutes < 60) {
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分`
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
}
