import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { getAnalysisTypes } from '@/services/ai/prompt-service'

async function handler(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await validateSession(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  if (request.method === 'GET') {
    const types = getAnalysisTypes()
    return NextResponse.json({ types })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = handler
