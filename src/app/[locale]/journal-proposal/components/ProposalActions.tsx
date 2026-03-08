'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { JournalProposalOutput } from '@/types/journal-proposal'

interface ProposalActionsProps {
  proposal: JournalProposalOutput | null
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onRegenerate: () => Promise<void>
  onExportToFreee: () => Promise<void>
  isProcessing?: boolean
  className?: string
}

export function ProposalActions({
  proposal,
  onApprove,
  onReject,
  onRegenerate,
  onExportToFreee,
  isProcessing = false,
  className,
}: ProposalActionsProps) {
  const t = useTranslations('journalProposal.actions')
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    setActionLoading(actionName)
    try {
      await action()
    } finally {
      setActionLoading(null)
    }
  }

  if (!proposal) {
    return null
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <Button
          variant="default"
          disabled={isProcessing || actionLoading !== null}
          onClick={() => setShowApproveDialog(true)}
        >
          {actionLoading === 'approve' ? '...' : t('approve')}
        </Button>
        <Button
          variant="destructive"
          disabled={isProcessing || actionLoading !== null}
          onClick={() => setShowRejectDialog(true)}
        >
          {actionLoading === 'reject' ? '...' : t('reject')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isProcessing || actionLoading !== null}>
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => handleAction(onRegenerate, 'regenerate')}
              disabled={actionLoading !== null}
            >
              {t('regenerate')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction(onExportToFreee, 'export')}
              disabled={actionLoading !== null}
            >
              {t('exportToFreee')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('approve')}</DialogTitle>
            <DialogDescription>{t('confirmApprove')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleAction(onApprove, 'approve')
                setShowApproveDialog(false)
              }}
            >
              {t('approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject')}</DialogTitle>
            <DialogDescription>{t('confirmReject')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleAction(onReject, 'reject')
                setShowRejectDialog(false)
              }}
            >
              {t('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
