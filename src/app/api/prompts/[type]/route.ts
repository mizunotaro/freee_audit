import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import {
  getPrompt,
  setPrompt,
  resetToDefault,
  type AnalysisType,
} from '@/services/ai/prompt-service'

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

  if (request.method === 'GET') {
    try {
      const prompt = await getPrompt(analysisType, user.companyId)
      return NextResponse.json({ prompt })
    } catch (error) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }
  }

  if (request.method === 'POST') {
    const body = await request.json()

    try {
      const prompt = await setPrompt(analysisType, user.companyId, {
        name: body.name,
        description: body.description,
        systemPrompt: body.systemPrompt,
        userPromptTemplate: body.userPromptTemplate,
        variables: body.variables,
      })
      return NextResponse.json({ prompt })
    } catch (error) {
      return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = handler
export const POST = handler
