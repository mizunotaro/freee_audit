'use client'

import { cn } from '@/lib/utils'
import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'

interface ConfidenceIndicatorProps {
  confidence: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Displays a visual confidence indicator with progress bar and optional label.
 *
 * @param props - Component props
 * @param props.confidence - Confidence value between 0 and 1
 * @param props.showLabel - Whether to show the percentage and level label
 * @param props.size - Size variant: 'sm', 'md', or 'lg'
 * @param props.className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <ConfidenceIndicator confidence={0.85} showLabel size="md" />
 * ```
 */
export function ConfidenceIndicator({
  confidence,
  showLabel = true,
  size = 'md',
  className,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100)
  const thresholds = JOURNAL_PROPOSAL_CONFIG.confidence.thresholds

  const getColor = () => {
    if (confidence >= thresholds.high) return 'bg-green-500'
    if (confidence >= thresholds.medium) return 'bg-yellow-500'
    if (confidence >= thresholds.low) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getLabel = () => {
    const labels = JOURNAL_PROPOSAL_CONFIG.confidence.labels.ja
    if (confidence >= thresholds.high) return labels.high
    if (confidence >= thresholds.medium) return labels.medium
    if (confidence >= thresholds.low) return labels.low
    return labels.veryLow
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

/**
 * Determines the confidence level based on the confidence value.
 *
 * @param confidence - Confidence value between 0 and 1
 * @returns The confidence level: 'high', 'medium', 'low', or 'very-low'
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'very-low' {
  const thresholds = JOURNAL_PROPOSAL_CONFIG.confidence.thresholds
  if (confidence >= thresholds.high) return 'high'
  if (confidence >= thresholds.medium) return 'medium'
  if (confidence >= thresholds.low) return 'low'
  return 'very-low'
}

/**
 * Gets the text color class based on confidence value.
 *
 * @param confidence - Confidence value between 0 and 1
 * @returns Tailwind CSS color class
 */
export function getConfidenceColor(confidence: number): string {
  const thresholds = JOURNAL_PROPOSAL_CONFIG.confidence.thresholds
  if (confidence >= thresholds.high) return 'text-green-600'
  if (confidence >= thresholds.medium) return 'text-yellow-600'
  if (confidence >= thresholds.low) return 'text-orange-600'
  return 'text-red-600'
}
