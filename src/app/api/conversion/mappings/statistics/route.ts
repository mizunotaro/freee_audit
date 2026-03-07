import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { accountMappingService } from '@/services/conversion/account-mapping-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const querySchema = z.object({
  sourceCoaId: z.string().optional(),
  targetCoaId: z.string().optional(),
})

async function getHandler(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams))

  const query = parseResult.success ? parseResult.data : {}

  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  try {
    const baseStats = await accountMappingService.getStatistics(companyId)

    const whereClause: Record<string, unknown> = { companyId }
    if (query.sourceCoaId) whereClause.sourceCoaId = query.sourceCoaId
    if (query.targetCoaId) whereClause.targetCoaId = query.targetCoaId

    const unmappedAccounts = await getUnmappedAccounts(companyId, query.targetCoaId)

    return NextResponse.json({
      data: {
        ...baseStats,
        unmappedAccounts,
      },
    })
  } catch (error) {
    console.error('Failed to fetch statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

async function getUnmappedAccounts(
  companyId: string,
  targetCoaId?: string
): Promise<Array<{ code: string; name: string; occurrenceCount: number; totalAmount: number }>> {
  const mappings = await prisma.accountMapping.findMany({
    where: {
      companyId,
      ...(targetCoaId && { targetCoaId }),
    },
    select: {
      sourceItemId: true,
    },
  })

  const mappedItemIds = new Set(mappings.map((m) => m.sourceItemId))

  const sourceCoas = await prisma.chartOfAccount.findMany({
    where: { companyId },
    include: {
      items: true,
    },
  })

  const unmapped: Array<{
    code: string
    name: string
    occurrenceCount: number
    totalAmount: number
  }> = []

  for (const coa of sourceCoas) {
    for (const item of coa.items) {
      if (!mappedItemIds.has(item.id)) {
        unmapped.push({
          code: item.code,
          name: item.name,
          occurrenceCount: 0,
          totalAmount: 0,
        })
      }
    }
  }

  return unmapped.slice(0, 50)
}

export const GET = withAuth(getHandler)
