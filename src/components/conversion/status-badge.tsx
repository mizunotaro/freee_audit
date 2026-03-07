'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConversionStatus } from '@/types/conversion'

interface StatusBadgeProps {
  status: ConversionStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const STATUS_CONFIG: Record<
  ConversionStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
> = {
  draft: {
    label: '下書き',
    variant: 'outline',
  },
  mapping: {
    label: 'マッピング中',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  validating: {
    label: '検証中',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  converting: {
    label: '変換中',
    variant: 'default',
  },
  reviewing: {
    label: 'レビュー中',
    variant: 'secondary',
    className: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  },
  completed: {
    label: '完了',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  error: {
    label: 'エラー',
    variant: 'destructive',
  },
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  }

  return (
    <Badge variant={config.variant} className={cn(config.className, sizeClasses[size], className)}>
      {config.label}
    </Badge>
  )
}
