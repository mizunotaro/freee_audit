import { NextRequest, NextResponse } from 'next/server'
import { TaxService } from '@/services/tax/tax-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, fiscalYearEndMonth, fiscalYear } = body

    if (!companyId || !fiscalYearEndMonth || !fiscalYear) {
      return NextResponse.json(
        { error: 'companyId, fiscalYearEndMonth, and fiscalYear are required' },
        { status: 400 }
      )
    }

    const schedules = await TaxService.generateDefaultTaxSchedules(
      companyId,
      fiscalYearEndMonth,
      fiscalYear
    )

    return NextResponse.json(schedules, { status: 201 })
  } catch (error) {
    console.error('Error generating default tax schedules:', error)
    return NextResponse.json({ error: 'Failed to generate default tax schedules' }, { status: 500 })
  }
}
