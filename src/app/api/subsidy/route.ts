import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { createSubsidyProject, getSubsidyProjects } from '@/services/subsidy'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.companyId) {
      return NextResponse.json({ success: false, error: 'Company not set' }, { status: 400 })
    }

    const result = await getSubsidyProjects(user.companyId)
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

    if (user.role !== 'ADMIN' && user.role !== 'ACCOUNTANT') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    if (!user.companyId) {
      return NextResponse.json({ success: false, error: 'Company not set' }, { status: 400 })
    }

    const result = await createSubsidyProject({
      ...body,
      companyId: user.companyId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
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
