import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { checkProcurementConsistency } from '@/services/procurement'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { caseId } = body

    if (!caseId) {
      return NextResponse.json({ success: false, error: 'caseId is required' }, { status: 400 })
    }

    const result = await checkProcurementConsistency(caseId)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
