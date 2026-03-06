import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AccrualExpenseTracker } from '@/services/deferred-accrual'

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
    const unpaidOnly = searchParams.get('unpaid') === 'true'

    const expenses = unpaidOnly
      ? await AccrualExpenseTracker.getUnpaidAccrualExpenses(companyId)
      : await AccrualExpenseTracker.getAccrualExpenses(companyId)

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching accrual expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch accrual expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const companyId = body.companyId || (await getCompanyId())

    const expense = await AccrualExpenseTracker.createAccrualExpense({
      companyId,
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
