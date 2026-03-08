'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ProposalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'exported'

interface StatusBadgeProps {
  status: ProposalStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const STATUS_CONFIG: Record<
  ProposalStatus,
  {
    labelKey: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
> = {
  draft: {
    labelKey: 'draft',
    variant: 'outline',
  },
  pending: {
    labelKey: 'pending',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  approved: {
    labelKey: 'approved',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  rejected: {
    labelKey: 'rejected',
    variant: 'destructive',
  },
  exported: {
    labelKey: 'exported',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
}

const STATUS_LABELS: Record<ProposalStatus, Record<'ja' | 'en', string>> = {
  draft: { ja: '下書き', en: 'Draft' },
  pending: { ja: '確認待ち', en: 'Pending Review' },
  approved: { ja: '承認済み', en: 'Approved' },
  rejected: { ja: '却下済み', en: 'Rejected' },
  exported: { ja: '転送済み', en: 'Exported' },
}

/**
 * Displays a badge indicating the status of a journal proposal.
 *
 * @param props - Component props
 * @param props.status - The current status of the proposal
 * @param props.size - Size variant: 'sm', 'md', or 'lg'
 * @param props.className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <StatusBadge status="approved" size="md" />
 * ```
 */
export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const label = STATUS_LABELS[status]

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  }

  return (
    <Badge variant={config.variant} className={cn(config.className, sizeClasses[size], className)}>
      {label.ja}
    </Badge>
  )
}

/**
 * Gets the localized label for a proposal status.
 *
 * @param status - The proposal status
 * @param locale - The locale to use ('ja' or 'en')
 * @returns The localized status label
 */
export function getStatusLabel(status: ProposalStatus, locale: 'ja' | 'en' = 'ja'): string {
  return STATUS_LABELS[status][locale]
}
