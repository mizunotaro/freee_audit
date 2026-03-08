import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { resetToDefault, type AnalysisType } from '@/services/ai/prompt-service'

async function handler(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await validateSession(token)
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { type } = await params
  const analysisType = type as AnalysisType

  if (request.method === 'POST') {
    try {
      await resetToDefault(analysisType, user.companyId)
      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json({ error: 'Failed to reset prompt' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const POST = handler
