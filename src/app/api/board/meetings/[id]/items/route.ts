import { NextRequest, NextResponse } from 'next/server'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
