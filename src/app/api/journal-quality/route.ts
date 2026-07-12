import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'
import type { Journal } from '@/types'
import {
  analyzeJournalQuality,
  type UnbalancedReason,
} from '@/services/validation/journal-quality-validator'

type FlagKind = 'duplicate' | 'unbalanced'
type FlagSeverity = 'info' | 'warning'

interface JournalFlag {
  kind: FlagKind
  severity: FlagSeverity
  reason: string
}

const UNBALANCED_REASON_LABELS: Record<UnbalancedReason, string> = {
  non_finite_amount: '金額が数値ではありません',
  non_positive_amount: '金額が0以下です',
  non_finite_tax: '税額が数値ではありません',
  negative_tax: '税額が負の値です',
  self_offsetting: '借方・貸方が同一科目です',
}

async function handler(req: AuthenticatedRequest) {
  try {
    const searchParams = new URL(req.url).searchParams
    const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

    const journals = await prisma.journal.findMany({
      where: { companyId },
      orderBy: { entryDate: 'desc' },
      take: 500,
    })

    const qualityInput: Journal[] = journals.map((j) => ({
      id: j.id,
      companyId: j.companyId,
      freeeJournalId: j.freeeJournalId,
      entryDate: j.entryDate,
      description: j.description,
      debitAccount: j.debitAccount,
      creditAccount: j.creditAccount,
      amount: j.amount,
      taxAmount: j.taxAmount,
      taxType: j.taxType ?? undefined,
      documentId: j.documentId ?? undefined,
      auditStatus: j.auditStatus as Journal['auditStatus'],
      syncedAt: j.syncedAt,
      createdAt: j.createdAt,
    }))

    const result = analyzeJournalQuality(qualityInput)
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze journal quality' } },
        { status: 500 }
      )
    }
    const report = result.data

    const duplicateIds = new Set<string>()
    for (const group of report.duplicates.groups) {
      for (const id of group.journalIds) duplicateIds.add(id)
    }
    const unbalancedReasons = new Map<string, UnbalancedReason[]>()
    for (const entry of report.unbalanced.entries) {
      unbalancedReasons.set(entry.journalId, entry.reasons)
    }

    const data = journals.map((j) => {
      const flags: JournalFlag[] = []
      if (duplicateIds.has(j.id)) {
        flags.push({
          kind: 'duplicate',
          severity: 'warning',
          reason: '重複する仕訳が検出されました',
        })
      }
      const reasons = unbalancedReasons.get(j.id)
      if (reasons) {
        for (const reason of reasons) {
          flags.push({
            kind: 'unbalanced',
            severity: 'warning',
            reason: UNBALANCED_REASON_LABELS[reason],
          })
        }
      }
      return {
        id: j.id,
        freeeJournalId: j.freeeJournalId,
        entryDate: j.entryDate.toISOString().split('T')[0],
        description: j.description,
        debitAccount: j.debitAccount,
        creditAccount: j.creditAccount,
        amount: j.amount,
        taxAmount: j.taxAmount,
        flags,
      }
    })

    const flagged = data.filter((j) => j.flags.length > 0).length

    return NextResponse.json({
      data,
      summary: {
        total: data.length,
        flagged,
        duplicateGroups: report.duplicates.totalGroups,
        unbalancedEntries: report.unbalanced.total,
        hasIssues: report.hasIssues,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch journal quality' } },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handler, { requireCompany: true })
