import { NextRequest, NextResponse } from 'next/server'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const meeting = await BoardMeetingService.getBoardMeetingById(params.id)

    if (!meeting) {
      return NextResponse.json({ error: 'Board meeting not found' }, { status: 404 })
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error fetching board meeting:', error)
    return NextResponse.json({ error: 'Failed to fetch board meeting' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { meetingDate, meetingType, minutes, status } = body

    const meeting = await BoardMeetingService.updateBoardMeeting(params.id, {
      meetingDate: meetingDate ? new Date(meetingDate) : undefined,
      meetingType,
      minutes,
      status,
    })

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error updating board meeting:', error)
    return NextResponse.json({ error: 'Failed to update board meeting' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await BoardMeetingService.deleteBoardMeeting(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting board meeting:', error)
    return NextResponse.json({ error: 'Failed to delete board meeting' }, { status: 500 })
  }
}
