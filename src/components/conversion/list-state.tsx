'use client'

import { AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ListResolution } from '@/components/conversion/resolve-list-status'

export type ListStateStatus = Extract<ListResolution, 'loading' | 'error' | 'empty'>

export interface ListStateProps {
  status: ListStateStatus
  error?: string
  emptyTitle?: string
  emptyMessage?: string
  skeletonRows?: number
  className?: string
}

const DEFAULT_ERROR_MESSAGE = 'データの取得に失敗しました'
const DEFAULT_EMPTY_MESSAGE = 'データがありません'

export function ListState({
  status,
  error,
  emptyTitle,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  skeletonRows = 4,
  className,
}: ListStateProps) {
  if (status === 'loading') {
    return (
      <div className={cn('rounded-lg border p-4', className)} role="status" aria-busy="true">
        <div className="flex flex-col gap-3">
          {Array.from({ length: skeletonRows }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
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
    <div className={cn('rounded-lg border border-dashed p-8 text-center', className)} role="status">
      {emptyTitle && <p className="text-muted-foreground">{emptyTitle}</p>}
      <p className={cn('text-sm text-muted-foreground', emptyTitle && 'mt-1')}>{emptyMessage}</p>
    </div>
  )
}
