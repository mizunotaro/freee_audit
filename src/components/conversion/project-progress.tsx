'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import type { ConversionProgress } from '@/types/conversion'

interface ProjectProgressProps {
  projectId: string
  onComplete?: () => void
  pollInterval?: number
}

export function ProjectProgress({
  projectId,
  onComplete,
  pollInterval = 2000,
}: ProjectProgressProps) {
  const [progress, setProgress] = useState<ConversionProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/conversion/projects/${projectId}/progress`)
        if (!res.ok) throw new Error('Failed to fetch progress')
        const data = await res.json()

        if (mounted) {
          setProgress(data.data)
          setError(null)

          if (data.data.status === 'completed' || data.data.status === 'error') {
            if (data.data.status === 'completed' && onComplete) {
              onComplete()
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      }
    }

    fetchProgress()
    const intervalId = setInterval(fetchProgress, pollInterval)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [projectId, pollInterval, onComplete])

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>進捗の取得に失敗しました: {error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'converting':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (progress.status) {
      case 'converting':
        return '変換中...'
      case 'completed':
        return '完了'
      case 'error':
        return 'エラー'
      case 'validating':
        return '検証中...'
      default:
        return progress.status
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          {getStatusText()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">進捗</span>
            <span className="font-medium">{Math.round(progress.progress)}%</span>
          </div>
          <Progress value={progress.progress} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">処理済み仕訳</span>
            <div className="font-medium">
              {progress.processedJournals} / {progress.totalJournals}
            </div>
          </div>
          {progress.estimatedCompletion && (
            <div>
              <span className="text-muted-foreground">完了予定</span>
              <div className="font-medium">
                {new Date(progress.estimatedCompletion).toLocaleTimeString('ja-JP')}
              </div>
            </div>
          )}
        </div>

        {progress.currentItem && (
          <div className="rounded bg-muted p-2 text-xs">
            <span className="text-muted-foreground">処理中: </span>
            {progress.currentItem}
          </div>
        )}

        {progress.errors.length > 0 && (
          <div className="space-y-1">
            <span className="text-sm font-medium text-destructive">エラー</span>
            <ul className="text-xs text-destructive">
              {progress.errors.slice(0, 3).map((err, i) => (
                <li key={i}>• {err.message}</li>
              ))}
              {progress.errors.length > 3 && <li>...他 {progress.errors.length - 3}件</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
