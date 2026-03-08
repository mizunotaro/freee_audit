import type { IntentType, IntentClassification, OrchestratorContext } from './orchestrator-types'

type Result<T> = { success: true; data: T } | { success: false; error: Error }

interface IntentPattern {
  readonly intent: IntentType
  readonly keywords: readonly string[]
  readonly patterns: readonly RegExp[]
  readonly weight: number
}

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    intent: 'financial_analysis',
    keywords: ['分析', '財務', '決算', 'bs', 'pl', 'balance', 'profit', '損益', '貸借'],
    patterns: [
      /財務.*分析/i,
      /決算.*見/i,
      /bs.*pl/i,
      /balance.*sheet/i,
      /損益計算書/i,
      /貸借対照表/i,
      /分析.*して/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'tax_inquiry',
    keywords: ['税', 'tax', '法人税', '消費税', '控除', 'deduction', '申告'],
    patterns: [
      /税.*について/i,
      /法人税/i,
      /消費税/i,
      /税引前/i,
      /tax\s*(deduction|liability)/i,
      /節税/i,
      /申告/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'strategic_planning',
    keywords: ['戦略', 'strategy', '計画', 'plan', '成長', 'growth', '今後', '将来'],
    patterns: [
      /戦略.*立案/i,
      /成長.*戦略/i,
      /事業.*計画/i,
      /今後.*どう/i,
      /将来.*予測/i,
      /strategy/i,
    ],
    weight: 0.9,
  },
  {
    intent: 'compliance_check',
    keywords: ['コンプライアンス', 'compliance', '規定', '規則', '監査', 'audit'],
    patterns: [/コンプライアンス/i, /監査/i, /規定.*違反/i, /内部統制/i, /compliance/i, /audit/i],
    weight: 0.9,
  },
  {
    intent: 'ratio_analysis',
    keywords: ['比率', 'ratio', '流動', 'liquidity', '安全性', 'safety', '収益性'],
    patterns: [
      /流動比率/i,
      /自己資本比率/i,
      /ro[ae]/i,
      /roi/i,
      /財務.*比率/i,
      /ratio.*analysis/i,
      /指標.*分析/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'cashflow_analysis',
    keywords: ['キャッシュフロー', 'cash.?flow', '資金', 'cash', '運転資金'],
    patterns: [
      /キャッシュフロー/i,
      /cf/i,
      /資金繰/i,
      /営業cf/i,
      /投資cf/i,
      /財務cf/i,
      /cash\s*flow/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'budget_inquiry',
    keywords: ['予算', 'budget', '実績', '差異', 'variance'],
    patterns: [/予算.*実績/i, /予実.*差異/i, /budget.*variance/i, /予算.*達成/i, /budget/i],
    weight: 0.9,
  },
  {
    intent: 'forecast_request',
    keywords: ['予測', 'forecast', '見込み', 'projection', '将来'],
    patterns: [/将来.*予測/i, /売上.*見込/i, /forecast/i, /予測.*して/i, /projection/i],
    weight: 0.9,
  },
]

export function classifyIntent(
  query: string,
  _context: OrchestratorContext
): Result<IntentClassification> {
  if (!query || typeof query !== 'string') {
    return {
      success: false,
      error: new Error('Invalid query: must be a non-empty string'),
    }
  }

  const sanitizedQuery = sanitizeQuery(query)
  const scores = calculateIntentScores(sanitizedQuery)
  const sortedIntents = sortIntentsByScore(scores)

  if (sortedIntents.length === 0) {
    return {
      success: true,
      data: {
        primary: 'general_inquiry',
        confidence: 0.5,
        secondary: [],
        keywords: [],
      },
    }
  }

  const [primary, ...secondary] = sortedIntents
  const totalScore = sortedIntents.reduce((sum, [, score]) => sum + score, 0)
  const confidence = totalScore > 0 ? primary[1] / totalScore : 0.5

  const matchedKeywords = extractMatchedKeywords(sanitizedQuery, primary[0])

  return {
    success: true,
    data: {
      primary: primary[0],
      confidence: Math.min(1, Math.max(0, confidence)),
      secondary: secondary.slice(0, 2).map(([intent]) => intent),
      keywords: matchedKeywords,
    },
  }
}

function sanitizeQuery(query: string): string {
  return (
    query
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000)
  )
}

function calculateIntentScores(query: string): Map<IntentType, number> {
  const scores = new Map<IntentType, number>()
  const lowerQuery = query.toLowerCase()

  for (const pattern of INTENT_PATTERNS) {
    let score = 0

    for (const keyword of pattern.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        score += pattern.weight
      }
    }

    for (const regex of pattern.patterns) {
      if (regex.test(query)) {
        score += pattern.weight * 2
      }
    }

    if (score > 0) {
      const currentScore = scores.get(pattern.intent) ?? 0
      scores.set(pattern.intent, currentScore + score)
    }
  }

  return scores
}

function sortIntentsByScore(scores: Map<IntentType, number>): [IntentType, number][] {
  return Array.from(scores.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
}

function extractMatchedKeywords(query: string, intent: IntentType): string[] {
  const pattern = INTENT_PATTERNS.find((p) => p.intent === intent)
  if (!pattern) return []

  const lowerQuery = query.toLowerCase()
  return pattern.keywords.filter((kw) => lowerQuery.includes(kw.toLowerCase())).slice(0, 5)
}

export function getWorkflowForIntent(intent: IntentType): string {
  const workflowMap: Record<IntentType, string> = {
    financial_analysis: 'comprehensive_analysis',
    tax_inquiry: 'tax_focused',
    strategic_planning: 'strategic_analysis',
    compliance_check: 'compliance_review',
    ratio_analysis: 'ratio_focused',
    cashflow_analysis: 'cashflow_focused',
    budget_inquiry: 'budget_analysis',
    forecast_request: 'forecast_analysis',
    general_inquiry: 'general_consultation',
  }
  return workflowMap[intent] ?? 'general_consultation'
}
