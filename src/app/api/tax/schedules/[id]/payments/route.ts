import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { TaxService } from '@/services/tax/tax-service'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

async function verifyScheduleOwnership(scheduleId: string, companyId: string): Promise<boolean> {
  const schedule = await TaxService.getTaxScheduleById(scheduleId)
  return schedule?.companyId === companyId
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyScheduleOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payments = await TaxService.getTaxPayments(params.id)
    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching tax payments:', error)
    return NextResponse.json({ error: 'Failed to fetch tax payments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyScheduleOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { paymentDate, amount, paymentMethod, referenceNumber, note } = body

    if (!paymentDate || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'paymentDate, amount, and paymentMethod are required' },
        { status: 400 }
      )
    }

    const payment = await TaxService.createTaxPayment({
      taxScheduleId: params.id,
      paymentDate: new Date(paymentDate),
      amount,
      paymentMethod,
      referenceNumber,
      note,
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Error creating tax payment:', error)
    return NextResponse.json({ error: 'Failed to create tax payment' }, { status: 500 })
  }
}
