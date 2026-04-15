import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const requestSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
})

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { fiscalYear, month } = parsed.data
    const companyId = await validateCompanyId(req.user, null)
    const monthLabel = `${fiscalYear}年${month}月`

    const report = await prisma.boardReport.upsert({
      where: { companyId_fiscalYear_month: { companyId, fiscalYear, month } },
      update: {},
      create: {
        companyId,
        fiscalYear,
        month,
        title: `${monthLabel}度 取締役会報告書`,
        summary: `${monthLabel}度の業績・財務状況・重要事項を取締役会向けにまとめた報告書です。`,
        status: 'DRAFT',
        sections: {
          create: [
            {
              sectionType: 'financial_summary',
              title: '財務サマリー',
              content: `${monthLabel}度の財務状況の概要を記載します。`,
              sortOrder: 1,
            },
            {
              sectionType: 'kpi_update',
              title: 'KPIアップデート',
              content: '主要KPIの進捗状況を記載します。',
              sortOrder: 2,
            },
            {
              sectionType: 'risk_items',
              title: 'リスク事項',
              content: '今月の主要リスクと対応状況を記載します。',
              sortOrder: 3,
            },
            {
              sectionType: 'next_actions',
              title: '次月アクション',
              content: '次月の主要アクションプランを記載します。',
              sortOrder: 4,
            },
          ],
        },
      },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Board report generate error:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

export const POST = withAuth(postHandler, { requireCompany: true })
