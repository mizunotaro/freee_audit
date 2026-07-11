import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { calculateDetailedActualVsBudget } from '@/services/budget/detailed-actual-vs-budget'
import { generateSamplePL } from '@/services/budget/sample-pl'
import {
  computeManagerialMetrics,
  buildVarianceBridge,
} from '@/services/budget/managerial-accounting'
import type { ProfitLoss } from '@/types'
import type { ManagerialReportResponse } from '@/types/reports/managerial'

const STAGE_REVENUE = '売上高'
const STAGE_COST_OF_SALES = '売上原価'
const STAGE_SGA = '販売管理費'

/**
 * GET /api/reports/budget/managerial?fiscalYear=&month=
 *
 * 管理会計（CVP分析）指標と予実差異ブリッジを返す。
 * 計算式はサービス層（managerial-accounting.ts）に保持し、本ルートは
 * 段階損益（stageLevel）からの数値抽出と分類（売上原価=変動費、販売管理費=固定費）のみを行う。
 *
 * 注意: 実績 P&L は budget 詳細アクションと同様にサンプル値（generateSamplePL）を使用する。
 * 実データの trial balance 連携は fin-design-01 提案で PENDING HUMAN DETERMINATION。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const monthParam = searchParams.get('month')
    if (!monthParam) {
      return NextResponse.json(
        { error: 'Month is required for managerial analysis' },
        { status: 400 }
      )
    }
    const month = parseInt(monthParam)

    const samplePL = generateSamplePL(fiscalYear, month)
    const detailed = await calculateDetailedActualVsBudget(
      user.companyId,
      fiscalYear,
      month,
      samplePL as ProfitLoss
    )

    const stages = detailed.stageLevel
    const revenueStage = stages.find((s) => s.stage === STAGE_REVENUE)
    const cogsStage = stages.find((s) => s.stage === STAGE_COST_OF_SALES)
    const sgaStage = stages.find((s) => s.stage === STAGE_SGA)

    let metrics = null
    if (revenueStage && cogsStage && sgaStage) {
      const metricsResult = computeManagerialMetrics({
        revenue: revenueStage.actual,
        variableCosts: cogsStage.actual,
        fixedCosts: sgaStage.actual,
      })
      if (metricsResult.success) {
        metrics = metricsResult.data
      }
    }

    const bridgeResult = buildVarianceBridge({
      startLabel: '営業利益（予算）',
      endLabel: '営業利益（実績）',
      stages,
    })
    const bridge = bridgeResult.success ? bridgeResult.data : null

    const body: ManagerialReportResponse = {
      fiscalYear,
      month,
      metrics,
      bridge,
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Managerial budget API error:', error)
    return NextResponse.json({ error: 'Failed to process managerial request' }, { status: 500 })
  }
}
