import { NextRequest, NextResponse } from 'next/server'
import { ValuationQAService, ValuationQARequest } from '@/services/valuation/qa'
import type { ValuationQAResult } from '@/services/valuation/qa'
import { createAIProviderFromEnv } from '@/lib/integrations/ai'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ValuationQARequest

  if (!body.calculationType || !body.inputs || !body.result || !body.steps) {
    return NextResponse.json(
      { error: 'Missing required fields: calculationType, inputs, result, steps' },
      { status: 400 }
    )
  }

  try {
    const aiProvider = createAIProviderFromEnv()
    const qaService = new ValuationQAService({ llmProvider: aiProvider ?? undefined })
    const result = await qaService.validate(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json<ValuationQAResult>(result.data)
  } catch (error) {
    console.error('Valuation QA error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
