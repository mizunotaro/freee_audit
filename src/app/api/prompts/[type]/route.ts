import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { getPrompt, setPrompt } from '@/services/ai/prompt-service'
import { logRouteAudit } from '@/lib/route-audit'
import { analysisTypeSchema, promptBodySchema } from '../schemas'

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
  const typeResult = analysisTypeSchema.safeParse(type)
  if (!typeResult.success) {
    return NextResponse.json(
      { error: 'Invalid analysis type', details: typeResult.error.flatten() },
      { status: 400 }
    )
  }
  const analysisType = typeResult.data

  if (request.method === 'GET') {
    try {
      const result = await getPrompt(analysisType, user.companyId)
      if (!result.success) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      }
      return NextResponse.json({ prompt: result.data })
    } catch {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }
  }

  if (request.method === 'POST') {
    const parsed = promptBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    try {
      const prompt = await setPrompt(analysisType, user.companyId, {
        name: parsed.data.name,
        description: parsed.data.description ?? undefined,
        systemPrompt: parsed.data.systemPrompt,
        userPromptTemplate: parsed.data.userPromptTemplate,
        variables: parsed.data.variables,
      })
      await logRouteAudit({
        request,
        userId: user.id,
        action: 'PROMPT_UPDATE',
        resource: 'custom_prompt',
        resourceId: analysisType,
      })
      return NextResponse.json({ prompt })
    } catch {
      await logRouteAudit({
        request,
        userId: user.id,
        action: 'PROMPT_UPDATE',
        resource: 'custom_prompt',
        resourceId: analysisType,
        result: 'FAILURE',
      })
      return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = handler
export const POST = handler
