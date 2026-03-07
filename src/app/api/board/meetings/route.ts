import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meetings = await BoardMeetingService.getBoardMeetings(user.companyId)
    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Error fetching board meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch board meetings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { meetingDate, meetingType, minutes } = body

    if (!meetingDate || !meetingType) {
      return NextResponse.json(
        { error: 'meetingDate and meetingType are required' },
        { status: 400 }
      )
    }

    const meeting = await BoardMeetingService.createBoardMeeting({
      companyId: user.companyId,
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
