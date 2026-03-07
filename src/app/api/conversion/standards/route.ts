import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { accountingStandardService } from '@/services/conversion/accounting-standard-service'

async function getHandler(_req: AuthenticatedRequest) {
  try {
    const standards = await accountingStandardService.getAll()

    return NextResponse.json({
      data: standards.map((s) => ({
        code: s.code,
        name: s.name,
        nameEn: s.nameEn,
        description: s.description,
        countryCode: s.countryCode,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch standards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch standards', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
