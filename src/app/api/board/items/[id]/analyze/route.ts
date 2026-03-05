import { NextRequest, NextResponse } from 'next/server'
import { BoardMeetingService } from '@/services/board/board-meeting-service'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
