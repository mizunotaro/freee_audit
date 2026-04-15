import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { createSubsidyJournal, getSubsidyJournals } from '@/services/subsidy'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const year = parseInt(searchParams.get('year') ?? '', 10)
    const month = parseInt(searchParams.get('month') ?? '', 10)

    if (!projectId || isNaN(year) || isNaN(month)) {
      return NextResponse.json(
        { success: false, error: 'projectId, year, and month are required' },
        { status: 400 }
      )
    }

    const result = await getSubsidyJournals({
      projectId,
      year,
      month,
      workerName: searchParams.get('workerName') ?? undefined,
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = await createSubsidyJournal({
      ...body,
      date: new Date(body.date),
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
