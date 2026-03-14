import { NextResponse } from 'next/server'
import { sampleTherapeuticsData } from '@/lib/data/sample-therapeutics-data'

const TIMEOUT_MS = 5000

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), ms)
  )
  return Promise.race([promise, timeout])
}

export async function GET() {
  try {
    const data = await withTimeout(Promise.resolve(sampleTherapeuticsData), TIMEOUT_MS)

    if (!data) {
      return NextResponse.json({ success: false, error: 'Data not found' }, { status: 404 })
    }

    const company = data.company
    const kpis = data.kpis
    const milestones = data.milestones

    return NextResponse.json({
      success: true,
      data: {
        company: {
          name: company.name,
          stage: company.stage,
          leadCompound: company.leadCompound,
          developmentPhase: company.developmentPhase,
        },
        kpis: {
          runway: kpis.runway.months,
          monthlyBurnRate: kpis.monthlyBurnRate.average,
          cashBalance: data.cashFlow.endingCash,
          rdSpendYtd: data.profitLoss.expenses.rdExpenses.totalRd,
          externalRdRatio: kpis.rdEfficiency.externalRdRatio,
        },
        milestones: milestones.slice(0, 5),
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json({ success: false, error: 'Request timeout' }, { status: 504 })
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
