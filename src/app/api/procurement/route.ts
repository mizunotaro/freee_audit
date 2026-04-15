import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { createProcurementCase, getProcurementCases } from '@/services/procurement'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined

    if (!user.companyId) {
      return NextResponse.json({ success: false, error: 'Company not set' }, { status: 400 })
    }

    const result = await getProcurementCases(user.companyId, status)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!user.companyId) {
      return NextResponse.json({ success: false, error: 'Company not set' }, { status: 400 })
    }

    const result = await createProcurementCase({
      ...body,
      companyId: user.companyId,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
