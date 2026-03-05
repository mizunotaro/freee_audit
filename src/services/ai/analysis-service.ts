import type { BalanceSheet, ProfitLoss, CashFlowStatement, FinancialKPIs } from '@/types'

type AIProvider = 'openai' | 'gemini' | 'claude' | 'azure' | 'aws' | 'gcp'

interface AIConfig {
  provider: AIProvider
  apiKey?: string
  endpoint?: string
  region?: string
  projectId?: string
}

interface AnalysisResult {
  summary: string
  anomalies: AnomalyItem[]
  recommendations: RecommendationItem[]
  insights: string[]
}

interface AnomalyItem {
  category: string
  itemName: string
  currentValue: number
  expectedValue?: number
  deviationPercent?: number
  severity: 'high' | 'medium' | 'low'
  description: string
  possibleCauses: string[]
}

interface RecommendationItem {
  priority: 'high' | 'medium' | 'low'
  category: string
  action: string
  expectedImpact: string
}

const DEFAULT_PROMPT = `freeeから取得したスタートアップ企業の財務データを公認会計士・税理士の観点から分析を行って下さい。経営指標についてはVC/CVCや銀行員の観点からも評価をおこなってください。

分析にあたっては以下の点に注意してください：
1. 収益性、安全性、効率性、成長性の観点から総合評価を行う
2. 特異な数値や異常値があれば指摘する
3. 改善すべき点があれば具体的なアクションプランを提示する
4. 業界標準との比較観点も含める`

export async function analyzeFinancialData(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  kpis: FinancialKPIs,
  config: AIConfig,
  customPrompt?: string
): Promise<AnalysisResult> {
  const prompt = customPrompt || DEFAULT_PROMPT

  const financialData = formatFinancialDataForAnalysis(bs, pl, cf, kpis)

  try {
    switch (config.provider) {
      case 'openai':
        return await analyzeWithOpenAI(prompt, financialData, config.apiKey || '')
      case 'gemini':
        return await analyzeWithGemini(prompt, financialData, config.apiKey || '')
      case 'claude':
        return await analyzeWithClaude(prompt, financialData, config.apiKey || '')
      default:
        return generateMockAnalysis(bs, pl, cf, kpis)
    }
  } catch (error) {
    console.error('LLM analysis failed:', error)
    return generateMockAnalysis(bs, pl, cf, kpis)
  }
}

function formatFinancialDataForAnalysis(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  kpis: FinancialKPIs
): string {
  const lines: string[] = []

  lines.push('=== 貸借対照表 ===')
  lines.push(`\n【資産】`)
  bs.assets.current.forEach((a) => lines.push(`  ${a.name}: ${a.amount.toLocaleString()}円`))
  bs.assets.fixed.forEach((a) => lines.push(`  ${a.name}: ${a.amount.toLocaleString()}円`))
  lines.push(`  資産合計: ${bs.totalAssets.toLocaleString()}円`)

  lines.push(`\n【負債】`)
  bs.liabilities.current.forEach((l) => lines.push(`  ${l.name}: ${l.amount.toLocaleString()}円`))
  bs.liabilities.fixed.forEach((l) => lines.push(`  ${l.name}: ${l.amount.toLocaleString()}円`))
  lines.push(`  負債合計: ${bs.totalLiabilities.toLocaleString()}円`)

  lines.push(`\n【純資産】`)
  bs.equity.items.forEach((e) => lines.push(`  ${e.name}: ${e.amount.toLocaleString()}円`))
  lines.push(`  純資産合計: ${bs.totalEquity.toLocaleString()}円`)

  lines.push('\n=== 損益計算書 ===')
  pl.revenue.forEach((r) => lines.push(`  ${r.name}: ${r.amount.toLocaleString()}円`))
  lines.push(
    `  売上総利益: ${pl.grossProfit.toLocaleString()}円 (${pl.grossProfitMargin.toFixed(1)}%)`
  )
  lines.push(
    `  営業利益: ${pl.operatingIncome.toLocaleString()}円 (${pl.operatingMargin.toFixed(1)}%)`
  )
  lines.push(`  当期純利益: ${pl.netIncome.toLocaleString()}円`)

  lines.push('\n=== キャッシュフロー ===')
  const operatingCF =
    cf.operatingActivities?.netCashFromOperating || cf.operating?.netCashFromOperating || 0
  const investingCF =
    cf.investingActivities?.netCashFromInvesting || cf.investing?.netCashFromInvesting || 0
  const financingCF =
    cf.financingActivities?.netCashFromFinancing || cf.financing?.netCashFromFinancing || 0
  lines.push(`  営業CF: ${operatingCF.toLocaleString()}円`)
  lines.push(`  投資CF: ${investingCF.toLocaleString()}円`)
  lines.push(`  財務CF: ${financingCF.toLocaleString()}円`)

  lines.push('\n=== 経営指標 ===')
  lines.push(`  ROE: ${kpis.profitability.roe.toFixed(1)}%`)
  lines.push(`  ROA: ${kpis.profitability.roa.toFixed(1)}%`)
  lines.push(`  流動比率: ${kpis.safety.currentRatio.toFixed(1)}%`)
  lines.push(`  自己資本比率: ${kpis.safety.equityRatio.toFixed(1)}%`)
  lines.push(`  売上成長率: ${kpis.growth.revenueGrowth.toFixed(1)}%`)

  return lines.join('\n')
}

async function analyzeWithOpenAI(
  prompt: string,
  data: string,
  apiKey: string
): Promise<AnalysisResult> {
  if (!apiKey || process.env.AI_MOCK_MODE === 'true') {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'あなたは公認会計士・税理士として、財務データの分析とアドバイスを行います。JSON形式で回答してください。',
        },
        {
          role: 'user',
          content: `${prompt}\n\n${data}`,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const result = await response.json()
  return parseAnalysisResponse(result.choices[0].message.content)
}

async function analyzeWithGemini(
  prompt: string,
  data: string,
  apiKey: string
): Promise<AnalysisResult> {
  if (!apiKey || process.env.AI_MOCK_MODE === 'true') {
    throw new Error('Gemini API key not configured')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\n${data}` }] }],
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const result = await response.json()
  return parseAnalysisResponse(result.candidates[0].content.parts[0].text)
}

async function analyzeWithClaude(
  prompt: string,
  data: string,
  apiKey: string
): Promise<AnalysisResult> {
  if (!apiKey || process.env.AI_MOCK_MODE === 'true') {
    throw new Error('Claude API key not configured')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${data}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const result = await response.json()
  return parseAnalysisResponse(result.content[0].text)
}

function parseAnalysisResponse(responseText: string): AnalysisResult {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Failed to parse LLM response as JSON:', e)
  }

  return {
    summary: responseText.slice(0, 500),
    anomalies: [],
    recommendations: [],
    insights: [responseText.slice(0, 300)],
  }
}

function generateMockAnalysis(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  kpis: FinancialKPIs
): AnalysisResult {
  const anomalies: AnomalyItem[] = []
  const recommendations: RecommendationItem[] = []

  if (kpis.safety.currentRatio < 100) {
    anomalies.push({
      category: '安全性',
      itemName: '流動比率',
      currentValue: kpis.safety.currentRatio,
      expectedValue: 150,
      severity: 'high',
      description: '流動比率が100%を下回っています。短期的な支払能力に問題がある可能性があります。',
      possibleCauses: ['売掛金回収遅延', '在庫過剰', '短期借入の増加'],
    })
  }

  if (pl.operatingMargin < 5) {
    anomalies.push({
      category: '収益性',
      itemName: '営業利益率',
      currentValue: pl.operatingMargin,
      expectedValue: 10,
      severity: 'medium',
      description: '営業利益率が低水準です。コスト構造の見直しが必要かもしれません。',
      possibleCauses: ['粗利益率低下', '販管費増加', '価格競争激化'],
    })
  }

  const operatingCF =
    cf.operatingActivities?.netCashFromOperating || cf.operating?.netCashFromOperating || 0
  if (pl.netIncome > 0 && operatingCF < 0) {
    anomalies.push({
      category: 'キャッシュフロー',
      itemName: '営業キャッシュフロー',
      currentValue: operatingCF,
      severity: 'high',
      description: '黒字決算ながら営業CFがマイナスです。会計上の利益と現金の乖離があります。',
      possibleCauses: ['売掛金増加', '在庫積み増し', '買掛金減少'],
    })
  }

  if (kpis.profitability.roe < 10) {
    recommendations.push({
      priority: 'high',
      category: '収益性改善',
      action:
        'ROE向上施策の実施：資本効率の改善、収益性向上、または適切な財務レバレッジの活用を検討',
      expectedImpact: '株主価値の向上、資金調達力の強化',
    })
  }

  if (kpis.growth.revenueGrowth < 10) {
    recommendations.push({
      priority: 'medium',
      category: '成長戦略',
      action: '新規顧客獲得施策の強化、既存顧客へのアップセル・クロスセル推進',
      expectedImpact: '売上拡大、市場シェア向上',
    })
  }

  return {
    summary: `当期は${pl.netIncome >= 0 ? '黒字' : '赤字'}決算となりました。ROE ${kpis.profitability.roe.toFixed(1)}%、流動比率 ${kpis.safety.currentRatio.toFixed(0)}%です。`,
    anomalies,
    recommendations,
    insights: [
      '総合的に見て、財務状態は安定しています。',
      '継続的な収益改善に向けた取り組みが重要です。',
    ],
  }
}

export async function analyzeJournalEntry(
  entry: {
    id: string
    entryDate: Date
    description: string
    debitAccount: string
    creditAccount: string
    amount: number
    taxType?: string
  },
  receiptData?: string,
  config?: AIConfig
): Promise<{
  isValid: boolean
  issues: { field: string; issue: string; severity: 'error' | 'warning' }[]
  suggestion?: string
}> {
  if (!config?.apiKey || process.env.AI_MOCK_MODE === 'true') {
    return generateMockJournalAnalysis(entry, receiptData)
  }

  try {
    const prompt = `以下の仕訳と証憑情報の整合性を確認し、問題点を指摘してください。

仕訳情報:
- 日付: ${entry.entryDate.toLocaleDateString('ja-JP')}
- 借方科目: ${entry.debitAccount}
- 貸方科目: ${entry.creditAccount}
- 金額: ${entry.amount.toLocaleString()}円
- 税区分: ${entry.taxType || '不明'}
- 摘要: ${entry.description}

${receiptData ? `証憑情報:\n${receiptData}` : '証憑なし'}

確認事項:
1. 日付の整合性
2. 勘定科目の適切性
3. 金額の整合性
4. 税区分の正確性
5. 摘要の妥当性

JSON形式で回答:
{
  "isValid": boolean,
  "issues": [{ "field": string, "issue": string, "severity": "error" | "warning" }],
  "suggestion": string (optional)
}`

    if (config.provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const content = result.choices[0].message.content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }
    }
  } catch (error) {
    console.error('Journal analysis failed:', error)
  }

  return generateMockJournalAnalysis(entry, receiptData)
}

function generateMockJournalAnalysis(
  entry: {
    id: string
    entryDate: Date
    description: string
    debitAccount: string
    creditAccount: string
    amount: number
    taxType?: string
  },
  _receiptData?: string
): {
  isValid: boolean
  issues: { field: string; issue: string; severity: 'error' | 'warning' }[]
  suggestion?: string
} {
  const issues: { field: string; issue: string; severity: 'error' | 'warning' }[] = []

  if (entry.amount < 0) {
    issues.push({
      field: 'amount',
      issue: '金額が負の値です',
      severity: 'error',
    })
  }

  if (!entry.description || entry.description.length < 3) {
    issues.push({
      field: 'description',
      issue: '摘要が入力されていない、または短すぎます',
      severity: 'warning',
    })
  }

  if (!entry.taxType) {
    issues.push({
      field: 'taxType',
      issue: '税区分が設定されていません',
      severity: 'warning',
    })
  }

  const today = new Date()
  const entryDate = new Date(entry.entryDate)
  if (entryDate > today) {
    issues.push({
      field: 'entryDate',
      issue: '未来の日付が設定されています',
      severity: 'error',
    })
  }

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    suggestion: issues.length > 0 ? '内容を確認し、必要に応じて修正してください' : undefined,
  }
}
