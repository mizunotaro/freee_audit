import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { TaxService } from '@/services/tax/tax-service'
import { prisma } from '@/lib/db'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fiscalYearEndMonth, fiscalYear } = body
    const companyId = user.companyId

    if (!fiscalYearEndMonth || !fiscalYear) {
      return NextResponse.json(
        { error: 'fiscalYearEndMonth and fiscalYear are required' },
        { status: 400 }
      )
    }

    const taxSettings = await prisma.taxSettings.findUnique({
      where: { companyId },
    })

    const withholdingSpecialRule = taxSettings?.withholdingSpecialRule ?? false

    const schedules = await TaxService.generateDefaultTaxSchedules(
      companyId,
      fiscalYearEndMonth,
      fiscalYear,
      withholdingSpecialRule
    )

    return NextResponse.json(schedules, { status: 201 })
  } catch (error) {
    console.error('Error generating default tax schedules:', error)
    return NextResponse.json({ error: 'Failed to generate default tax schedules' }, { status: 500 })
  }
}
