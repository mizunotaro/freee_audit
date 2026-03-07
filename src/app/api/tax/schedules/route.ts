import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { TaxService } from '@/services/tax/tax-service'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const fiscalYear = searchParams.get('fiscalYear')

    const schedules = await TaxService.getTaxSchedules(
      user.companyId,
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
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { taxType, fiscalYear, dueDate, amount, note } = body

    if (!taxType || !fiscalYear || !dueDate) {
      return NextResponse.json(
        { error: 'taxType, fiscalYear, and dueDate are required' },
        { status: 400 }
      )
    }

    const schedule = await TaxService.createTaxSchedule({
      companyId: user.companyId,
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
