'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TaxTypeSelector } from '@/components/journal-proposal'
import type { JournalProposal, JournalEntryProposal } from '@/types/journal-proposal'

interface ProposalEditorProps {
  proposal: JournalProposal
  onSave: (proposal: JournalProposal) => void
  onCancel: () => void
  className?: string
}

export function ProposalEditor({ proposal, onSave, onCancel, className }: ProposalEditorProps) {
  const t = useTranslations('journalProposal')
  const [editedProposal, setEditedProposal] = useState<JournalProposal>(proposal)

  const updateEntry = (entryId: string, updates: Partial<JournalEntryProposal>) => {
    setEditedProposal((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...updates } : entry
      ),
    }))
  }

  const handleSave = () => {
    const totalDebit = editedProposal.entries
      .filter((e) => e.lineType === 'debit')
      .reduce((sum, e) => sum + e.amount, 0)
    const totalCredit = editedProposal.entries
      .filter((e) => e.lineType === 'credit')
      .reduce((sum, e) => sum + e.amount, 0)

    if (totalDebit !== totalCredit) {
      alert(
        `借方と貸方の合計が一致しません。\n借方: ¥${totalDebit.toLocaleString()}\n貸方: ¥${totalCredit.toLocaleString()}`
      )
      return
    }

    onSave(editedProposal)
  }

  const debitEntries = editedProposal.entries.filter((e) => e.lineType === 'debit')
  const creditEntries = editedProposal.entries.filter((e) => e.lineType === 'credit')

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('actions.edit')}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              {t('actions.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave}>
              {t('actions.save')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-medium text-blue-600">{t('proposal.debit')}</h3>
            {debitEntries.map((entry) => (
              <EntryEditor
                key={entry.id}
                entry={entry}
                onChange={(updates) => updateEntry(entry.id, updates)}
              />
            ))}
            <div className="border-t pt-2">
              <div className="flex justify-between font-medium">
                <span>借方合計</span>
                <span>¥{debitEntries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-red-600">{t('proposal.credit')}</h3>
            {creditEntries.map((entry) => (
              <EntryEditor
                key={entry.id}
                entry={entry}
                onChange={(updates) => updateEntry(entry.id, updates)}
              />
            ))}
            <div className="border-t pt-2">
              <div className="flex justify-between font-medium">
                <span>貸方合計</span>
                <span>¥{creditEntries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface EntryEditorProps {
  entry: JournalEntryProposal
  onChange: (updates: Partial<JournalEntryProposal>) => void
}

function EntryEditor({ entry, onChange }: EntryEditorProps) {
  const t = useTranslations('journalProposal.proposal')

  return (
    <div className="space-y-3 rounded-lg bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t('account')}</Label>
          <Input
            value={entry.accountName}
            onChange={(e) => onChange({ accountName: e.target.value })}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">{t('amount')}</Label>
          <Input
            type="number"
            value={entry.amount}
            onChange={(e) => onChange({ amount: Number(e.target.value) })}
            className="h-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t('taxType')}</Label>
          <TaxTypeSelector
            value={entry.taxType}
            onChange={(value) => onChange({ taxType: value })}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">{t('taxAmount')}</Label>
          <Input
            type="number"
            value={entry.taxAmount}
            onChange={(e) => onChange({ taxAmount: Number(e.target.value) })}
            className="h-8"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">{t('description')}</Label>
        <Textarea
          value={entry.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="h-16 min-h-[60px]"
        />
      </div>
    </div>
  )
}
