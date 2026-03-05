import { NextRequest, NextResponse } from 'next/server'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const meetings = await BoardMeetingService.getBoardMeetings(companyId)
    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Error fetching board meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch board meetings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, meetingDate, meetingType, minutes } = body

    if (!companyId || !meetingDate || !meetingType) {
      return NextResponse.json(
        { error: 'companyId, meetingDate, and meetingType are required' },
        { status: 400 }
      )
    }

    const meeting = await BoardMeetingService.createBoardMeeting({
      companyId,
      meetingDate: new Date(meetingDate),
      meetingType,
      minutes,
    })

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    console.error('Error creating board meeting:', error)
    return NextResponse.json({ error: 'Failed to create board meeting' }, { status: 500 })
  }
}
