import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { AccrualExpenseTracker } from '@/services/deferred-accrual'

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
    const unpaidOnly = searchParams.get('unpaid') === 'true'

    const expenses = unpaidOnly
      ? await AccrualExpenseTracker.getUnpaidAccrualExpenses(user.companyId)
      : await AccrualExpenseTracker.getAccrualExpenses(user.companyId)

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching accrual expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch accrual expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const expense = await AccrualExpenseTracker.createAccrualExpense({
      companyId: user.companyId,
      accountCode: body.accountCode,
      accountName: body.accountName,
      accrualYear: body.accrualYear,
      accrualMonth: body.accrualMonth,
      expectedAmount: body.expectedAmount,
      actualAmount: body.actualAmount,
      accrualJournalId: body.accrualJournalId,
      notes: body.notes,
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating accrual expense:', error)
    return NextResponse.json({ error: 'Failed to create accrual expense' }, { status: 500 })
  }
}
