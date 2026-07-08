import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { BoardMeetingService } from '@/services/board/board-meeting-service'
import { logRouteAudit } from '@/lib/route-audit'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meeting = await BoardMeetingService.getBoardMeetingById(params.id)
    if (!meeting || meeting.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { fiscalYear } = body

    if (!fiscalYear) {
      return NextResponse.json({ error: 'fiscalYear is required' }, { status: 400 })
    }

    const items = await BoardMeetingService.generateDefaultAgendaItems(params.id, fiscalYear)
    await logRouteAudit({
      request,
      userId: user.id,
      action: 'BOARD_AGENDA_ITEM_GENERATE',
      resource: 'board_agenda_item',
      resourceId: params.id,
    })
    return NextResponse.json(items, { status: 201 })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'BOARD_AGENDA_ITEM_GENERATE',
      resource: 'board_agenda_item',
      resourceId: params.id,
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    console.error('Error generating default agenda items:', error)
    return NextResponse.json({ error: 'Failed to generate default agenda items' }, { status: 500 })
  }
}
