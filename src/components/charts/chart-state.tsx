'use client'

import { AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ChartResolution } from '@/components/charts/resolve-chart-status'

export type ChartStateStatus = Extract<ChartResolution, 'loading' | 'error' | 'empty'>

export interface ChartStateProps {
  status: ChartStateStatus
  error?: string
  emptyMessage?: string
  skeletonLines?: number
  className?: string
}

const DEFAULT_ERROR_MESSAGE = 'データの取得に失敗しました'
const DEFAULT_EMPTY_MESSAGE = 'データがありません'

export function ChartState({
  status,
  error,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  skeletonLines = 5,
  className,
}: ChartStateProps) {
  if (status === 'loading') {
    return (
      <div className={cn('flex flex-col gap-2', className)} role="status" aria-busy="true">
        {Array.from({ length: skeletonLines }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn('h-4 w-full', index === skeletonLines - 1 && 'w-2/3')}
          />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        className={cn('flex flex-col items-center gap-2 py-8 text-center', className)}
        role="alert"
      >
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{error || DEFAULT_ERROR_MESSAGE}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    </div>
  )
}
