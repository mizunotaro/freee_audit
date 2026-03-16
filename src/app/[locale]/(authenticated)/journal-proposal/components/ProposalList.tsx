'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { StatusBadge, ConfidenceIndicator } from '@/components/journal-proposal'
import type { JournalProposalOutput } from '@/types/journal-proposal'
import type { ProposalStatus } from '@/components/journal-proposal'
import { useState, useMemo } from 'react'

interface ProposalListProps {
  proposals: Array<JournalProposalOutput & { status: ProposalStatus }>
  onSelectProposal: (proposal: JournalProposalOutput) => void
  className?: string
}

type SortField = 'date' | 'amount' | 'confidence'
type SortDirection = 'asc' | 'desc'

export function ProposalList({ proposals, onSelectProposal, className }: ProposalListProps) {
  const t = useTranslations('journalProposal.list')
  const tStatus = useTranslations('journalProposal.status')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filteredProposals = useMemo(() => {
    let result = [...proposals]

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'date':
          comparison = new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
          break
        case 'amount':
          comparison =
            (a.ocrResult.extractedInfo.totalAmount || 0) -
            (b.ocrResult.extractedInfo.totalAmount || 0)
          break
        case 'confidence':
          comparison = a.proposals[0]?.confidence - b.proposals[0]?.confidence
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [proposals, statusFilter, sortField, sortDirection])

  const paginatedProposals = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProposals.slice(start, start + pageSize)
  }, [filteredProposals, page])

  const totalPages = Math.ceil(filteredProposals.length / pageSize)

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatAmount = (amount: number | undefined) => {
    if (amount === undefined) return '-'
    return `¥${amount.toLocaleString()}`
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('title')}</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('filter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status')}</SelectItem>
                <SelectItem value="draft">{tStatus('draft')}</SelectItem>
                <SelectItem value="pending">{tStatus('pending')}</SelectItem>
                <SelectItem value="approved">{tStatus('approved')}</SelectItem>
                <SelectItem value="rejected">{tStatus('rejected')}</SelectItem>
                <SelectItem value="exported">{tStatus('exported')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortField}-${sortDirection}`}
              onValueChange={(v) => {
                const [field, direction] = v.split('-') as [SortField, SortDirection]
                setSortField(field)
                setSortDirection(direction)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">{t('sortDate')} ↓</SelectItem>
                <SelectItem value="date-asc">{t('sortDate')} ↑</SelectItem>
                <SelectItem value="amount-desc">{t('sortAmount')} ↓</SelectItem>
                <SelectItem value="amount-asc">{t('sortAmount')} ↑</SelectItem>
                <SelectItem value="confidence-desc">{t('sortConfidence')} ↓</SelectItem>
                <SelectItem value="confidence-asc">{t('sortConfidence')} ↑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {paginatedProposals.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t('noResults')}</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>AI Model</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProposals.map((proposal) => (
                  <TableRow
                    key={proposal.documentId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectProposal(proposal)}
                  >
                    <TableCell>
                      <StatusBadge status={proposal.status} size="sm" />
                    </TableCell>
                    <TableCell>{formatDate(proposal.generatedAt)}</TableCell>
                    <TableCell>{proposal.ocrResult.extractedInfo.vendorName || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatAmount(proposal.ocrResult.extractedInfo.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <ConfidenceIndicator
                        confidence={proposal.proposals[0]?.confidence || 0}
                        size="sm"
                        showLabel={false}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {proposal.aiModel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t('pagination.showing')} {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, filteredProposals.length)} {t('pagination.of')}{' '}
                {filteredProposals.length}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t('pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
