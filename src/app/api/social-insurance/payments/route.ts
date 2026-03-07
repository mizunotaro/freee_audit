import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { PaymentChecker } from '@/services/social-insurance'

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

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const insuranceType = searchParams.get('insuranceType') as any

    const payments = await PaymentChecker.getPayments(user.companyId, {
      insuranceType: insuranceType || undefined,
      year,
      month,
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching social insurance payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const payment = await PaymentChecker.createPayment({
      companyId: user.companyId,
      insuranceType: body.insuranceType,
      year: body.year,
      month: body.month,
      expectedAmount: body.expectedAmount,
      actualAmount: body.actualAmount,
      dueDate: new Date(body.dueDate),
      journalEntryId: body.journalEntryId,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      notes: body.notes,
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Error creating social insurance payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
