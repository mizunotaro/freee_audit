'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ConfidenceIndicator,
  TaxTypeSelector,
  getTaxTypeLabel,
} from '@/components/journal-proposal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { JournalProposal, JournalEntryProposal } from '@/types/journal-proposal'

interface ProposalCardProps {
  proposal: JournalProposal
  isSelected?: boolean
  isEditing?: boolean
  onSelect?: () => void
  onEdit?: (proposal: JournalProposal) => void
  onApprove?: () => void
  onReject?: () => void
  className?: string
}

export function ProposalCard({
  proposal,
  isSelected = false,
  isEditing = false,
  onSelect,
  onEdit,
  onApprove,
  onReject,
  className,
}: ProposalCardProps) {
  const t = useTranslations('journalProposal')
  const [editedProposal, setEditedProposal] = useState(proposal)
  const [showReasoning, setShowReasoning] = useState(false)

  const handleEntryChange = (
    entryId: string,
    field: keyof JournalEntryProposal,
    value: unknown
  ) => {
    setEditedProposal((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      ),
    }))
  }

  const handleSaveEdit = () => {
    onEdit?.(editedProposal)
  }

  const debitEntries = proposal.entries.filter((e) => e.lineType === 'debit')
  const creditEntries = proposal.entries.filter((e) => e.lineType === 'credit')

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-red-100 text-red-800'
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">#{proposal.rank}</Badge>
            <CardTitle className="text-base">
              {t('proposal.selectProposal')} {proposal.rank}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <ConfidenceIndicator confidence={proposal.confidence} size="sm" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-blue-600">{t('proposal.debit')}</h4>
            {debitEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={isEditing ? editedProposal.entries.find((e) => e.id === entry.id)! : entry}
                isEditing={isEditing}
                onChange={(field, value) => handleEntryChange(entry.id, field, value)}
              />
            ))}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600">{t('proposal.credit')}</h4>
            {creditEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={isEditing ? editedProposal.entries.find((e) => e.id === entry.id)! : entry}
                isEditing={isEditing}
                onChange={(field, value) => handleEntryChange(entry.id, field, value)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t pt-2">
          <Badge className={getRiskColor(proposal.riskAssessment.overallRisk)}>
            {t('proposal.risk.overallRisk')}:{' '}
            {t(`proposal.risk.${proposal.riskAssessment.overallRisk}`)}
          </Badge>
          {proposal.riskAssessment.recommendations.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {proposal.riskAssessment.recommendations.length} recommendations
            </span>
          )}
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setShowReasoning(!showReasoning)
            }}
            className="w-full"
          >
            {showReasoning ? 'Hide' : 'Show'} {t('proposal.reasoning.title')}
          </Button>

          {showReasoning && (
            <div className="mt-2 space-y-3 rounded-lg bg-muted/30 p-3 text-sm">
              <div>
                <h5 className="font-medium">{t('proposal.reasoning.accountSelection')}</h5>
                <p className="text-muted-foreground">{proposal.reasoning.accountSelection}</p>
              </div>
              <div>
                <h5 className="font-medium">{t('proposal.reasoning.taxClassification')}</h5>
                <p className="text-muted-foreground">{proposal.reasoning.taxClassification}</p>
              </div>
              {proposal.reasoning.keyAssumptions.length > 0 && (
                <div>
                  <h5 className="font-medium">{t('proposal.reasoning.keyAssumptions')}</h5>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {proposal.reasoning.keyAssumptions.map((assumption, i) => (
                      <li key={i}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSaveEdit()
                }}
              >
                {t('actions.save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(proposal)
                }}
              >
                {t('actions.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(proposal)
                }}
              >
                {t('actions.edit')}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation()
                  onApprove?.()
                }}
              >
                {t('actions.approve')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onReject?.()
                }}
              >
                {t('actions.reject')}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface EntryRowProps {
  entry: JournalEntryProposal
  isEditing: boolean
  onChange: (field: keyof JournalEntryProposal, value: unknown) => void
}

function EntryRow({ entry, isEditing, onChange }: EntryRowProps) {
  if (isEditing) {
    return (
      <div className="space-y-1 rounded bg-muted/50 p-2 text-sm">
        <Input
          value={entry.accountName}
          onChange={(e) => onChange('accountName', e.target.value)}
          className="h-7 text-sm"
          placeholder="Account"
        />
        <Input
          type="number"
          value={entry.amount}
          onChange={(e) => onChange('amount', Number(e.target.value))}
          className="h-7 text-sm"
          placeholder="Amount"
        />
        <TaxTypeSelector
          value={entry.taxType}
          onChange={(value) => onChange('taxType', value)}
          className="h-7 text-sm"
        />
        <Textarea
          value={entry.description}
          onChange={(e) => onChange('description', e.target.value)}
          className="h-7 min-h-[60px] text-sm"
          placeholder="Description"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1 rounded bg-muted/50 p-2 text-sm">
      <div className="font-medium">{entry.accountName}</div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">¥{entry.amount.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">{getTaxTypeLabel(entry.taxType)}</span>
      </div>
      {entry.description && (
        <div className="truncate text-xs text-muted-foreground">{entry.description}</div>
      )}
    </div>
  )
}
