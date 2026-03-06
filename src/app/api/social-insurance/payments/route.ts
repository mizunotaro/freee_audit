import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PaymentChecker } from '@/services/social-insurance'

async function getCompanyId(): Promise<string> {
  const companies = await prisma.company.findMany({ take: 1 })
  if (companies.length > 0) {
    return companies[0].id
  }
  const company = await prisma.company.create({
    data: { name: 'Default Company', fiscalYearStart: 1 },
  })
  return company.id
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') || (await getCompanyId())
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const insuranceType = searchParams.get('insuranceType') as any

    const payments = await PaymentChecker.getPayments(companyId, {
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
    const body = await request.json()
    const companyId = body.companyId || (await getCompanyId())

    const payment = await PaymentChecker.createPayment({
      companyId,
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
