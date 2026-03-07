import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meeting = await BoardMeetingService.getBoardMeetingById(params.id)

    if (!meeting) {
      return NextResponse.json({ error: 'Board meeting not found' }, { status: 404 })
    }

    if (meeting.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error fetching board meeting:', error)
    return NextResponse.json({ error: 'Failed to fetch board meeting' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingMeeting = await BoardMeetingService.getBoardMeetingById(params.id)
    if (!existingMeeting || existingMeeting.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingMeeting = await BoardMeetingService.getBoardMeetingById(params.id)
    if (!existingMeeting || existingMeeting.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await BoardMeetingService.deleteBoardMeeting(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting board meeting:', error)
    return NextResponse.json({ error: 'Failed to delete board meeting' }, { status: 500 })
  }
}
