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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyItemOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { companyInfo } = body

    if (!companyInfo) {
      return NextResponse.json({ error: 'companyInfo is required' }, { status: 400 })
    }

    const analysis = await BoardMeetingService.analyzeAgendaItemWithAI(params.id, companyInfo)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error analyzing agenda item:', error)
    return NextResponse.json({ error: 'Failed to analyze agenda item' }, { status: 500 })
  }
}
