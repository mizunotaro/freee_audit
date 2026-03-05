import { NextRequest, NextResponse } from 'next/server'
import { TaxService } from '@/services/tax/tax-service'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payments = await TaxService.getTaxPayments(params.id)
    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching tax payments:', error)
    return NextResponse.json({ error: 'Failed to fetch tax payments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
