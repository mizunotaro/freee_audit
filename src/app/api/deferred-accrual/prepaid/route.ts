import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PrepaidExpenseTracker } from '@/services/deferred-accrual'

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
    const activeOnly = searchParams.get('active') === 'true'

    const expenses = activeOnly
      ? await PrepaidExpenseTracker.getActivePrepaidExpenses(companyId)
      : await PrepaidExpenseTracker.getPrepaidExpenses(companyId)

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching prepaid expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch prepaid expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const companyId = body.companyId || (await getCompanyId())

    const expense = await PrepaidExpenseTracker.createPrepaidExpense({
      companyId,
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
