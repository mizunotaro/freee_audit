import type { PersonaType } from '@/lib/ai/personas/types'
import type {
  PersonaAnalysis,
  SynthesizedResponse,
  DivergentView,
  IntentClassification,
} from './orchestrator-types'

const PERSONA_NAMES: Record<PersonaType, string> = {
  cpa: '公認会計士',
  tax_accountant: '税理士',
  cfo: 'CFO',
  financial_analyst: '財務アナリスト',
}

const PERSONA_PRIORITIES: Record<string, Record<PersonaType, number>> = {
  financial_analysis: { cpa: 3, financial_analyst: 2, cfo: 2, tax_accountant: 1 },
  tax_inquiry: { tax_accountant: 3, cpa: 2, cfo: 1, financial_analyst: 1 },
  strategic_planning: { cfo: 3, financial_analyst: 2, cpa: 1, tax_accountant: 1 },
  compliance_check: { cpa: 3, tax_accountant: 2, cfo: 1, financial_analyst: 1 },
  ratio_analysis: { financial_analyst: 3, cpa: 2, cfo: 2, tax_accountant: 1 },
  cashflow_analysis: { cfo: 3, financial_analyst: 2, cpa: 2, tax_accountant: 1 },
  budget_inquiry: { cfo: 3, financial_analyst: 2, cpa: 1, tax_accountant: 1 },
  forecast_request: { financial_analyst: 3, cfo: 2, cpa: 1, tax_accountant: 1 },
  general_inquiry: { cpa: 2, cfo: 2, financial_analyst: 2, tax_accountant: 2 },
}

export function synthesizeResponses(
  analyses: readonly PersonaAnalysis[],
  intentClassification: IntentClassification
): SynthesizedResponse {
  if (analyses.length === 0) {
    return createEmptyResponse()
  }

  const sortedAnalyses = sortByPriority(analyses, intentClassification.primary)
  const summary = generateSummary(sortedAnalyses, intentClassification)
  const consensusPoints = extractConsensusPoints(sortedAnalyses)
  const divergentViews = identifyDivergentViews(sortedAnalyses)
  const recommendedAction = generateRecommendedAction(sortedAnalyses, intentClassification)
  const confidence = calculateOverallConfidence(sortedAnalyses)

  const totalCost = calculateTotalCost(analyses)

  return {
    summary,
    personaAnalyses: analyses,
    consensusPoints,
    divergentViews,
    recommendedAction,
    confidence,
    processingTimeMs: 0,
    totalCost,
  }
}

function createEmptyResponse(): SynthesizedResponse {
  return {
    summary: '分析を完了できませんでした。',
    personaAnalyses: [],
    consensusPoints: [],
    divergentViews: [],
    recommendedAction: '詳細な分析のため、より多くの情報を提供してください。',
    confidence: 0,
    processingTimeMs: 0,
    totalCost: 0,
  }
}

function sortByPriority(
  analyses: readonly PersonaAnalysis[],
  primaryIntent: string
): readonly PersonaAnalysis[] {
  const priorities = PERSONA_PRIORITIES[primaryIntent] ?? PERSONA_PRIORITIES.general_inquiry

  return [...analyses].sort((a, b) => {
    const priorityA = priorities[a.persona] ?? 1
    const priorityB = priorities[b.persona] ?? 1
    return priorityB - priorityA
  })
}

function generateSummary(
  analyses: readonly PersonaAnalysis[],
  intentClassification: IntentClassification
): string {
  const primaryAnalysis = analyses[0]
  if (!primaryAnalysis) return '分析結果がありません。'

  const personaName = PERSONA_NAMES[primaryAnalysis.persona]
  const conclusion = primaryAnalysis.response.conclusion

  const otherPerspectives = analyses
    .slice(1, 3)
    .map((a) => `${PERSONA_NAMES[a.persona]}の視点`)
    .join('、')

  let summary = `【${personaName}の主要結論】\n${conclusion}\n\n`

  if (otherPerspectives) {
    summary += `また、${otherPerspectives}からの補足分析も行いました。`
  }

  if (intentClassification.confidence > 0.8) {
    summary += `\n\n※この分析は高い信頼度（${Math.round(intentClassification.confidence * 100)}%）で分類された質問に対する回答です。`
  }

  return summary
}

function extractConsensusPoints(analyses: readonly PersonaAnalysis[]): string[] {
  if (analyses.length < 2) return []

  const allReasoningPoints = analyses.flatMap((a) =>
    a.response.reasoning.map((r) => ({
      point: r.point.toLowerCase(),
      originalPoint: r.point,
      confidence: r.confidence,
    }))
  )

  const consensusPoints: string[] = []
  const processedPoints = new Set<string>()

  for (const point of allReasoningPoints) {
    const key = point.point.slice(0, 50)
    if (processedPoints.has(key)) continue

    const matchingPoints = allReasoningPoints.filter(
      (p) => calculateSimilarity(p.point, point.point) > 0.6
    )

    if (matchingPoints.length >= 2 && point.confidence >= 0.7) {
      consensusPoints.push(point.originalPoint)
      processedPoints.add(key)
    }
  }

  return consensusPoints.slice(0, 5)
}

function identifyDivergentViews(analyses: readonly PersonaAnalysis[]): DivergentView[] {
  if (analyses.length < 2) return []

  const divergentViewsMap = new Map<
    string,
    { topic: string; perspectives: Array<{ persona: PersonaType; viewpoint: string }> }
  >()

  for (const analysis of analyses) {
    const alternatives = analysis.response.alternatives
    if (!alternatives || alternatives.length === 0) continue

    for (const alt of alternatives.slice(0, 2)) {
      const key = alt.option.toLowerCase().slice(0, 50)
      const existingView = divergentViewsMap.get(key)

      if (existingView) {
        existingView.perspectives.push({
          persona: analysis.persona,
          viewpoint: alt.pros.length > 0 ? alt.pros[0] : alt.option,
        })
      } else {
        divergentViewsMap.set(key, {
          topic: alt.option,
          perspectives: [
            {
              persona: analysis.persona,
              viewpoint: alt.pros.length > 0 ? alt.pros[0] : alt.option,
            },
          ],
        })
      }
    }
  }

  return Array.from(divergentViewsMap.values())
    .filter((v) => v.perspectives.length >= 2)
    .slice(0, 3)
    .map((v) => ({
      topic: v.topic,
      perspectives: v.perspectives,
    }))
}

function generateRecommendedAction(
  analyses: readonly PersonaAnalysis[],
  _intentClassification: IntentClassification
): string {
  const allRisks = analyses.flatMap((a) => a.response.risks)
  const highRisks = allRisks.filter((r) => r.severity === 'high' || r.severity === 'critical')

  const recommendedActions = analyses
    .filter((a) => a.response.recommendedAction)
    .map((a) => ({
      persona: a.persona,
      action: a.response.recommendedAction!,
      confidence: a.response.confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence)

  let recommendation = ''

  if (highRisks.length > 0) {
    recommendation += `【重要なリスク警告】\n${highRisks
      .slice(0, 2)
      .map((r) => `- ${r.description}`)
      .join('\n')}\n\n`
  }

  if (recommendedActions.length > 0) {
    const topAction = recommendedActions[0]
    recommendation += `【推奨アクション】（${PERSONA_NAMES[topAction.persona]}より）\n${topAction.action}`
  } else {
    recommendation += '【推奨アクション】\n詳細な分析結果に基づき、段階的な対応を検討してください。'
  }

  return recommendation
}

function calculateOverallConfidence(analyses: readonly PersonaAnalysis[]): number {
  if (analyses.length === 0) return 0

  const confidences = analyses.map((a) => a.response.confidence)
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length
  const minConfidence = Math.min(...confidences)

  return Math.round((avgConfidence * 0.7 + minConfidence * 0.3) * 100) / 100
}

function calculateTotalCost(analyses: readonly PersonaAnalysis[]): number {
  const avgCostPer1kTokens = 0.005
  const totalTokens = analyses.reduce((sum, a) => sum + a.tokensUsed, 0)
  return Math.round((totalTokens / 1000) * avgCostPer1kTokens * 10000) / 10000
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter((w) => words2.has(w)))
  const union = new Set([...words1, ...words2])

  if (union.size === 0) return 0
  return intersection.size / union.size
}
