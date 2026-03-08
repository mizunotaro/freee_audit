import type { ComplexityScore, ComplexityFactors } from './types'

interface ComplexityRules {
  reasoningIndicators: string[]
  domainTerms: Record<string, string[]>
  riskIndicators: string[]
}

const RULES: ComplexityRules = {
  reasoningIndicators: [
    'なぜ',
    'どうして',
    '理由',
    '原因',
    '根拠',
    'why',
    'because',
    'reason',
    'cause',
    'justify',
  ],
  domainTerms: {
    accounting: [
      '仕訳',
      '貸借対照表',
      '損益計算書',
      '減価償却',
      'journal',
      'balance sheet',
      'depreciation',
    ],
    tax: ['法人税', '消費税', '還付', '所得', 'corporate tax', 'consumption tax', 'deduction'],
    finance: ['キャッシュフロー', 'ROE', 'ROA', '流動比率', 'cash flow', 'ratio'],
  },
  riskIndicators: [
    'リスク',
    '懸念',
    '問題',
    '課題',
    '注意',
    'risk',
    'concern',
    'issue',
    'warning',
    'attention',
  ],
}

export function analyzeComplexity(input: string, dataTokenCount: number = 0): ComplexityScore {
  const sanitizedInput = sanitizeInput(input)
  const sanitizedTokenCount = sanitizeTokenCount(dataTokenCount)

  const factors: ComplexityFactors = {
    reasoningDepth: analyzeReasoningDepth(sanitizedInput),
    domainKnowledge: analyzeDomainKnowledge(sanitizedInput),
    dataVolume: analyzeDataVolume(sanitizedTokenCount),
    outputStructure: analyzeOutputStructure(sanitizedInput),
    riskLevel: analyzeRiskLevel(sanitizedInput),
  }

  const overall = calculateOverallComplexity(factors)
  const confidence = calculateConfidence(factors)

  return {
    overall,
    factors,
    confidence,
  }
}

function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  return input.trim().slice(0, 100000)
}

function sanitizeTokenCount(count: number): number {
  if (!Number.isFinite(count) || count < 0) {
    return 0
  }
  return Math.min(count, 10000000)
}

function analyzeReasoningDepth(input: string): number {
  let score = 20
  const lowerInput = input.toLowerCase()

  for (const indicator of RULES.reasoningIndicators) {
    if (lowerInput.includes(indicator.toLowerCase())) {
      score += 10
    }
  }

  const questionMarks = (input.match(/\?|？/g) || []).length
  score += Math.min(questionMarks * 5, 20)

  const sentences = input.split(/[.!?。！？]/).filter((s) => s.trim().length > 0)
  score += Math.min(sentences.length * 3, 15)

  return Math.min(score, 100)
}

function analyzeDomainKnowledge(input: string): number {
  let score = 10
  const lowerInput = input.toLowerCase()

  for (const terms of Object.values(RULES.domainTerms)) {
    for (const term of terms) {
      if (lowerInput.includes(term.toLowerCase())) {
        score += 8
      }
    }
  }

  return Math.min(score, 100)
}

function analyzeDataVolume(tokenCount: number): number {
  if (tokenCount === 0) return 0
  if (tokenCount < 500) return 10
  if (tokenCount < 2000) return 30
  if (tokenCount < 5000) return 50
  if (tokenCount < 10000) return 70
  return 90
}

function analyzeOutputStructure(input: string): number {
  const lowerInput = input.toLowerCase()
  let score = 20

  if (lowerInput.includes('json') || lowerInput.includes('表')) {
    score += 30
  }
  if (lowerInput.includes('レポート') || lowerInput.includes('report')) {
    score += 20
  }
  if (lowerInput.includes('複数') || lowerInput.includes('multiple')) {
    score += 15
  }
  if (lowerInput.includes('比較') || lowerInput.includes('compare')) {
    score += 15
  }

  return Math.min(score, 100)
}

function analyzeRiskLevel(input: string): number {
  let score = 10
  const lowerInput = input.toLowerCase()

  for (const indicator of RULES.riskIndicators) {
    if (lowerInput.includes(indicator.toLowerCase())) {
      score += 15
    }
  }

  if (lowerInput.includes('重要') || lowerInput.includes('critical')) {
    score += 20
  }

  return Math.min(score, 100)
}

function calculateOverallComplexity(factors: ComplexityFactors): number {
  const weights = {
    reasoningDepth: 0.25,
    domainKnowledge: 0.2,
    dataVolume: 0.15,
    outputStructure: 0.15,
    riskLevel: 0.25,
  }

  const weightedSum =
    factors.reasoningDepth * weights.reasoningDepth +
    factors.domainKnowledge * weights.domainKnowledge +
    factors.dataVolume * weights.dataVolume +
    factors.outputStructure * weights.outputStructure +
    factors.riskLevel * weights.riskLevel

  return Math.round(weightedSum)
}

function calculateConfidence(factors: ComplexityFactors): number {
  const variance = calculateVariance(Object.values(factors))
  const confidence = 1 - variance / 2500
  return Math.max(0.3, Math.min(1, confidence))
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
}
