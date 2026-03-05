import { NextRequest, NextResponse } from 'next/server'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
