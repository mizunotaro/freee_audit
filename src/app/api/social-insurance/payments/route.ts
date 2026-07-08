import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSession } from '@/lib/auth'
import { PaymentChecker } from '@/services/social-insurance'
import { logRouteAudit } from '@/lib/route-audit'

const paymentsQuerySchema = z.object({
  insuranceType: z.enum(['health', 'pension', 'employment', 'work_accident', 'care']).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
})

const createPaymentSchema = z.object({
  insuranceType: z.enum(['health', 'pension', 'employment', 'work_accident', 'care']),
  year: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  expectedAmount: z.coerce.number(),
  actualAmount: z.coerce.number(),
  dueDate: z.coerce.date(),
  journalEntryId: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().optional(),
})

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
    const query = paymentsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: query.error.flatten() },
        { status: 400 }
      )
    }

    const payments = await PaymentChecker.getPayments(user.companyId, {
      insuranceType: query.data.insuranceType,
      year: query.data.year,
      month: query.data.month,
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

    const parsed = createPaymentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const payment = await PaymentChecker.createPayment({
      companyId: user.companyId,
      ...parsed.data,
    })

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'SOCIAL_INSURANCE_PAYMENT_CREATE',
      resource: 'social_insurance_payment',
      resourceId: payment.id,
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'SOCIAL_INSURANCE_PAYMENT_CREATE',
      resource: 'social_insurance_payment',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    console.error('Error creating social insurance payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
