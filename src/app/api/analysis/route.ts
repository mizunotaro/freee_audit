import { NextRequest, NextResponse } from 'next/server'
import { analyzeFinancialData } from '@/services/ai/analysis-service'
import { getKPIBenchmarks, calculateFinancialKPIs } from '@/services/analytics/financial-kpi'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bs, pl, cf, kpis, provider, apiKey, prompt } = body

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
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      },
      prompt
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis API error:', error)
    return NextResponse.json({ error: 'Failed to analyze financial data' }, { status: 500 })
  }
}
