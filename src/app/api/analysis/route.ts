import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { analyzeFinancialData } from '@/services/ai/analysis-service'
import { calculateFinancialKPIs } from '@/services/analytics/financial-kpi'
import { logRouteAudit } from '@/lib/route-audit'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bs, pl, cf, kpis, provider, prompt } = body

    if (!bs || !pl || !cf) {
      return NextResponse.json({ error: 'Missing financial data' }, { status: 400 })
    }

    let analysisKpis = kpis
    if (!analysisKpis) {
      analysisKpis = calculateFinancialKPIs(bs, pl, cf)
    }

    const result = await analyzeFinancialData(
      bs,
      pl,
      cf,
      analysisKpis,
      {
        provider: provider || 'openai',
      },
      prompt
    )

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'ANALYSIS_RUN',
      resource: 'analysis',
    })

    return NextResponse.json(result)
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'ANALYSIS_RUN',
      resource: 'analysis',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    console.error('Analysis API error:', error)
    return NextResponse.json({ error: 'Failed to analyze financial data' }, { status: 500 })
  }
}
