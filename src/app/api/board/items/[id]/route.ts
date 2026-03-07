import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

async function verifyItemOwnership(itemId: string, companyId: string): Promise<boolean> {
  const item = await prisma.agendaItem.findUnique({
    where: { id: itemId },
    include: { boardMeeting: { select: { companyId: true } } },
  })
  return item?.boardMeeting.companyId === companyId
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyItemOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyItemOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await BoardMeetingService.deleteAgendaItem(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agenda item:', error)
    return NextResponse.json({ error: 'Failed to delete agenda item' }, { status: 500 })
  }
}
