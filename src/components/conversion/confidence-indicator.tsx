'use client'

import { cn } from '@/lib/utils'

interface ConfidenceIndicatorProps {
  confidence: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ConfidenceIndicator({
  confidence,
  showLabel = true,
  size = 'md',
  className,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100)

  const getColor = () => {
    if (confidence >= 0.9) return 'bg-green-500'
    if (confidence >= 0.7) return 'bg-yellow-500'
    if (confidence >= 0.5) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getLabel = () => {
    if (confidence >= 0.9) return '高'
    if (confidence >= 0.7) return '中'
    if (confidence >= 0.5) return '低'
    return '要確認'
  }

  const sizeClasses = {
    sm: 'h-1.5 w-16',
    md: 'h-2 w-24',
    lg: 'h-3 w-32',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-full rounded-full bg-gray-200', sizeClasses[size])}>
        <div
          className={cn('rounded-full transition-all', getColor())}
          style={{ width: `${percentage}%`, height: '100%' }}
        />
      </div>
      {showLabel && (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {percentage}% ({getLabel()})
        </span>
      )}
    </div>
  )
}
