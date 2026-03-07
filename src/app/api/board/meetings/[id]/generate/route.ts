import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

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
    return NextResponse.json(items, { status: 201 })
  } catch (error) {
    console.error('Error generating default agenda items:', error)
    return NextResponse.json({ error: 'Failed to generate default agenda items' }, { status: 500 })
  }
}
