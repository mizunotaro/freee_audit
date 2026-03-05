import { NextRequest, NextResponse } from 'next/server'
import { TaxService } from '@/services/tax/tax-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const fiscalYear = searchParams.get('fiscalYear')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const schedules = await TaxService.getTaxSchedules(
      companyId,
      fiscalYear ? parseInt(fiscalYear) : undefined
    )

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching tax schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch tax schedules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, taxType, fiscalYear, dueDate, amount, note } = body

    if (!companyId || !taxType || !fiscalYear || !dueDate) {
      return NextResponse.json(
        { error: 'companyId, taxType, fiscalYear, and dueDate are required' },
        { status: 400 }
      )
    }

    const schedule = await TaxService.createTaxSchedule({
      companyId,
      taxType,
      fiscalYear,
      dueDate: new Date(dueDate),
      amount,
      note,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Error creating tax schedule:', error)
    return NextResponse.json({ error: 'Failed to create tax schedule' }, { status: 500 })
  }
}
