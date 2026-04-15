import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { runFullExpenseCheck } from '@/services/expense-check'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'ACCOUNTANT') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { expenses, commuteRoutes, policy } = body

    if (!expenses || !Array.isArray(expenses)) {
      return NextResponse.json(
        { success: false, error: 'expenses array is required' },
        { status: 400 }
      )
    }

    if (!user.companyId) {
      return NextResponse.json({ success: false, error: 'Company not set' }, { status: 400 })
    }

    const result = await runFullExpenseCheck({
      companyId: user.companyId,
      expenses,
      commuteRoutes,
      policy,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
