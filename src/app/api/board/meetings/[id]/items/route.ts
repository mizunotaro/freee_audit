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
    const { title, description, category, decisionType, requiredByLaw, legalBasis } = body

    if (!title || !category || !decisionType) {
      return NextResponse.json(
        { error: 'title, category, and decisionType are required' },
        { status: 400 }
      )
    }

    const item = await BoardMeetingService.createAgendaItem({
      boardMeetingId: params.id,
      title,
      description,
      category,
      decisionType,
      requiredByLaw,
      legalBasis,
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating agenda item:', error)
    return NextResponse.json({ error: 'Failed to create agenda item' }, { status: 500 })
  }
}
