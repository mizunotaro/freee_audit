import type { TaskCategory, TaskMetadata } from './types'

interface ClassificationKeywords {
  complex_reasoning: string[]
  detailed_analysis: string[]
  standard_analysis: string[]
  fast_response: string[]
}

const KEYWORDS: ClassificationKeywords = {
  complex_reasoning: [
    '戦略',
    '方針',
    '意思決定',
    '提案',
    '比較検討',
    'strategy',
    'decision',
    'recommend',
    'compare',
    'evaluate',
  ],
  detailed_analysis: [
    '分析',
    '評価',
    '計算',
    '判定',
    '確認',
    'リスク',
    'analyze',
    'assess',
    'calculate',
    'determine',
    'risk',
  ],
  standard_analysis: [
    '説明',
    '要約',
    '解釈',
    '概要',
    'トレンド',
    'explain',
    'summarize',
    'interpret',
    'overview',
    'trend',
  ],
  fast_response: [
    '分類',
    '抽出',
    '変換',
    'フォーマット',
    'classify',
    'extract',
    'convert',
    'format',
  ],
}

export function classifyTask(input: string, estimatedDataTokens: number = 0): TaskMetadata {
  const sanitizedInput = sanitizeInput(input)
  const normalizedInput = sanitizedInput.toLowerCase()

  const scores: Record<TaskCategory, number> = {
    complex_reasoning: 0,
    detailed_analysis: 0,
    standard_analysis: 0,
    fast_response: 0,
    embedding: 0,
  }

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedInput.includes(keyword.toLowerCase())) {
        scores[category as TaskCategory] += 1
      }
    }
  }

  if (estimatedDataTokens > 10000) {
    scores.detailed_analysis += 2
  } else if (estimatedDataTokens > 5000) {
    scores.standard_analysis += 1
  }

  const category = determineCategory(scores)
  const outputTokens = estimateOutputTokens(category)

  return {
    category,
    estimatedInputTokens: estimateInputTokens(sanitizedInput) + estimatedDataTokens,
    estimatedOutputTokens: outputTokens,
    requiresJson: requiresJsonOutput(sanitizedInput),
    requiresVision: false,
    maxLatencyMs: getMaxLatency(category),
  }
}

function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  return input.trim().slice(0, 100000)
}

function determineCategory(scores: Record<TaskCategory, number>): TaskCategory {
  let maxScore = 0
  let bestCategory: TaskCategory = 'standard_analysis'

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      bestCategory = category as TaskCategory
    }
  }

  if (maxScore === 0) {
    return 'standard_analysis'
  }

  return bestCategory
}

function estimateInputTokens(text: string): number {
  const length = text.length
  if (length === 0) return 0
  return Math.ceil(length / 4)
}

function estimateOutputTokens(category: TaskCategory): number {
  const estimates: Record<TaskCategory, number> = {
    complex_reasoning: 2000,
    detailed_analysis: 1500,
    standard_analysis: 800,
    fast_response: 300,
    embedding: 0,
  }
  return estimates[category]
}

function requiresJsonOutput(input: string): boolean {
  const jsonKeywords = ['json', 'json形式', '構造化', 'structured']
  const normalized = input.toLowerCase()
  return jsonKeywords.some((k) => normalized.includes(k))
}

function getMaxLatency(category: TaskCategory): number {
  const latencies: Record<TaskCategory, number> = {
    complex_reasoning: 60000,
    detailed_analysis: 45000,
    standard_analysis: 30000,
    fast_response: 10000,
    embedding: 5000,
  }
  return latencies[category]
}
