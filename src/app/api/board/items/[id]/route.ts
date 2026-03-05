import { NextRequest, NextResponse } from 'next/server'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      category,
      decisionType,
      requiredByLaw,
      legalBasis,
      aiAnalysis,
      resolution,
      resolutionStatus,
    } = body

    const item = await BoardMeetingService.updateAgendaItem(params.id, {
      title,
      description,
      category,
      decisionType,
      requiredByLaw,
      legalBasis,
      aiAnalysis,
      resolution,
      resolutionStatus,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating agenda item:', error)
    return NextResponse.json({ error: 'Failed to update agenda item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await BoardMeetingService.deleteAgendaItem(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agenda item:', error)
    return NextResponse.json({ error: 'Failed to delete agenda item' }, { status: 500 })
  }
}
