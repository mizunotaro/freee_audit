import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSession } from '@/lib/auth'
import { BoardMeetingService } from '@/services/board/board-meeting-service'
import { logRouteAudit } from '@/lib/route-audit'

const createMeetingSchema = z.object({
  meetingDate: z.coerce.date(),
  meetingType: z.enum(['regular', 'extraordinary']),
  minutes: z.string().nullish(),
})

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

    const parsed = createMeetingSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { meetingDate, meetingType, minutes } = parsed.data

    const meeting = await BoardMeetingService.createBoardMeeting({
      companyId: user.companyId,
      meetingDate: new Date(meetingDate),
      meetingType,
      minutes: minutes ?? undefined,
    })

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'BOARD_MEETING_CREATE',
      resource: 'board_meeting',
    })

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'BOARD_MEETING_CREATE',
      resource: 'board_meeting',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    console.error('Error creating board meeting:', error)
    return NextResponse.json({ error: 'Failed to create board meeting' }, { status: 500 })
  }
}
