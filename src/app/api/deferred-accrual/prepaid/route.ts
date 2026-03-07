import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { PrepaidExpenseTracker } from '@/services/deferred-accrual'

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
    const activeOnly = searchParams.get('active') === 'true'

    const expenses = activeOnly
      ? await PrepaidExpenseTracker.getActivePrepaidExpenses(user.companyId)
      : await PrepaidExpenseTracker.getPrepaidExpenses(user.companyId)

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching prepaid expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch prepaid expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const expense = await PrepaidExpenseTracker.createPrepaidExpense({
      companyId: user.companyId,
      accountCode: body.accountCode,
      accountName: body.accountName,
      originalAmount: body.originalAmount,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      totalMonths: body.totalMonths,
      notes: body.notes,
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating prepaid expense:', error)
    return NextResponse.json({ error: 'Failed to create prepaid expense' }, { status: 500 })
  }
}
