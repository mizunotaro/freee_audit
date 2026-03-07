import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { accountingStandardService } from '@/services/conversion/accounting-standard-service'
import type { AccountingStandard } from '@/types/conversion'

const VALID_CODES = ['JGAAP', 'USGAAP', 'IFRS'] as const

async function getHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  if (!context?.params) {
    return NextResponse.json(
      { error: 'Missing parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const params = await Promise.resolve(context.params)
  const code = params.code

  if (!VALID_CODES.includes(code as AccountingStandard)) {
    return NextResponse.json(
      { error: 'Invalid standard code', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  try {
    const standard = await accountingStandardService.getByCode(code as AccountingStandard)

    if (!standard) {
      return NextResponse.json({ error: 'Standard not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ data: standard })
  } catch (error) {
    console.error('Failed to fetch standard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch standard', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
