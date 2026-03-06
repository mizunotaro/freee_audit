import { prisma } from '@/lib/db'

export type AnalysisType =
  | 'FINANCIAL_ANALYSIS'
  | 'JOURNAL_AUDIT'
  | 'BUDGET_VARIANCE'
  | 'CASH_FLOW_FORECAST'
  | 'KPI_ANALYSIS'
  | 'BOARD_REPORT'

export interface PromptVariable {
  name: string
  description: string
  required: boolean
}

export interface AnalysisPromptDetail {
  id: string
  companyId: string | null
  analysisType: AnalysisType
  name: string
  description: string | null
  systemPrompt: string
  userPromptTemplate: string
  variables: PromptVariable[]
  isActive: boolean
  isDefault: boolean
  version: number
  parentPromptId: string | null
}

export interface RenderedPrompt {
  systemPrompt: string
  userPrompt: string
}

export const DEFAULT_PROMPTS: Record<
  AnalysisType,
  Omit<AnalysisPromptDetail, 'id' | 'companyId' | 'version' | 'parentPromptId'>
> = {
  FINANCIAL_ANALYSIS: {
    analysisType: 'FINANCIAL_ANALYSIS',
    name: '財務分析',
    description: 'BS/PL/CFデータに基づく総合的な財務分析',
    isDefault: true,
    isActive: true,
    systemPrompt: `あなたは公認会計士・税理士として、freeeから取得したスタートアップ企業の財務データを分析します。
経営指標についてはVC/CVCや銀行員の観点からも評価を行ってください。

分析にあたっては以下の点に注意してください：
1. 収益性、安全性、効率性、成長性の観点から総合評価を行う
2. 特異な数値や異常値があれば指摘する
3. 改善すべき点があれば具体的なアクションプランを提示する
4. 業界標準との比較観点も含める`,
    userPromptTemplate: `以下の財務データを分析してください。

## 対象期間
- 年度: {{fiscalYear}}
- 月: {{month}}

## 財務データ
{{financialData}}

## 経営指標
{{kpiData}}

## 分析要求
{{analysisRequest}}

以下の形式で回答してください：
{
  "summary": "サマリー（200文字程度）",
  "anomalies": [
    {
      "category": "カテゴリ",
      "itemName": "項目名",
      "currentValue": 数値,
      "severity": "high/medium/low",
      "description": "説明",
      "possibleCauses": ["原因1", "原因2"]
    }
  ],
  "recommendations": [
    {
      "priority": "high/medium/low",
      "category": "カテゴリ",
      "action": "推奨アクション",
      "expectedImpact": "期待される効果"
    }
  ],
  "insights": ["洞察1", "洞察2"]
}`,
    variables: [
      { name: 'fiscalYear', description: '対象年度', required: true },
      { name: 'month', description: '対象月', required: true },
      { name: 'financialData', description: '財務データ（BS/PL/CF）', required: true },
      { name: 'kpiData', description: '経営指標データ', required: true },
      { name: 'analysisRequest', description: '分析の依頼内容', required: false },
    ],
  },

  JOURNAL_AUDIT: {
    analysisType: 'JOURNAL_AUDIT',
    name: '仕訳監査',
    description: '個別仕訳の整合性チェック',
    isDefault: true,
    isActive: true,
    systemPrompt: `あなたは経験豊富な経理担当者として、仕訳の整合性を確認します。
証憑と仕訳情報を照合し、不整合や問題点を指摘してください。

確認事項：
1. 日付の整合性
2. 勘定科目の適切性
3. 金額の整合性
4. 税区分の正確性
5. 摘要の妥当性
6. 証憑との一致`,
    userPromptTemplate: `以下の仕訳と証憑情報の整合性を確認してください。

## 仕訳情報
- 日付: {{entryDate}}
- 借方科目: {{debitAccount}}
- 貸方科目: {{creditAccount}}
- 金額: {{amount}}
- 税区分: {{taxType}}
- 摘要: {{description}}

## 証憑情報
{{receiptInfo}}

JSON形式で回答してください：
{
  "isValid": boolean,
  "issues": [
    {
      "field": "フィールド名",
      "issue": "問題点",
      "severity": "error/warning/info"
    }
  ],
  "suggestion": "修正提案（あれば）"
}`,
    variables: [
      { name: 'entryDate', description: '仕訳日付', required: true },
      { name: 'debitAccount', description: '借方勘定科目', required: true },
      { name: 'creditAccount', description: '貸方勘定科目', required: true },
      { name: 'amount', description: '金額', required: true },
      { name: 'taxType', description: '税区分', required: false },
      { name: 'description', description: '摘要', required: false },
      { name: 'receiptInfo', description: '証憑情報', required: false },
    ],
  },

  BUDGET_VARIANCE: {
    analysisType: 'BUDGET_VARIANCE',
    name: '予実差異分析',
    description: '予算と実績の差異分析',
    isDefault: true,
    isActive: true,
    systemPrompt: `あなたは財務計画の専門家として、予実差異を分析します。
重要な差異について原因を推測し、改善策を提案してください。`,
    userPromptTemplate: `以下の予実データを分析してください。

## 対象期間
- 年度: {{fiscalYear}}
- 月: {{month}}

## 予実データ
{{budgetData}}

## 重要差異
{{significantVariances}}

分析結果をJSON形式で回答してください：
{
  "summary": "サマリー",
  "majorVariances": [
    {
      "item": "項目名",
      "variance": 差異額,
      "variancePercent": 差異率,
      "likelyCauses": ["推定原因"],
      "impactAssessment": "影響評価"
    }
  ],
  "recommendations": ["推奨事項"]
}`,
    variables: [
      { name: 'fiscalYear', description: '対象年度', required: true },
      { name: 'month', description: '対象月', required: true },
      { name: 'budgetData', description: '予実データ', required: true },
      { name: 'significantVariances', description: '重要差異一覧', required: true },
    ],
  },

  CASH_FLOW_FORECAST: {
    analysisType: 'CASH_FLOW_FORECAST',
    name: 'キャッシュフロー予測',
    description: '将来のキャッシュフロー予測',
    isDefault: true,
    isActive: true,
    systemPrompt: `あなたは財務の専門家として、キャッシュフロー予測を行います。
現在の財務状況から将来のキャッシュポジションを予測し、リスクと対策を提案してください。`,
    userPromptTemplate: `以下のデータに基づいてキャッシュフロー予測を行ってください。

## 現在のキャッシュポジション
{{currentCashPosition}}

## 過去のキャッシュフロー
{{historicalCashFlow}}

## 今後の支払予定
{{upcomingPayments}}

## 分析結果
{
  "forecast": {
    "3months": "3ヶ月後の予測キャッシュ",
    "6months": "6ヶ月後の予測キャッシュ",
    "12months": "12ヶ月後の予測キャッシュ"
  },
  "risks": ["リスク1", "リスク2"],
  "recommendations": ["推奨事項1", "推奨事項2"]
}`,
    variables: [
      { name: 'currentCashPosition', description: '現在のキャッシュポジション', required: true },
      { name: 'historicalCashFlow', description: '過去のキャッシュフロー', required: true },
      { name: 'upcomingPayments', description: '今後の支払予定', required: false },
    ],
  },

  KPI_ANALYSIS: {
    analysisType: 'KPI_ANALYSIS',
    name: 'KPI分析',
    description: '経営指標の分析と評価',
    isDefault: true,
    isActive: true,
    systemPrompt: `あなたは経営コンサルタントとして、KPIデータを分析します。
トレンド、異常値、改善機会を特定し、具体的なアクションプランを提案してください。`,
    userPromptTemplate: `以下のKPIデータを分析してください。

## 対象期間
- 年度: {{fiscalYear}}
- 月: {{month}}

## KPIデータ
{{kpiData}}

## 目標値
{{targets}}

分析結果をJSON形式で回答してください：
{
  "summary": "サマリー",
  "performance": [
    {
      "kpi": "KPI名",
      "currentValue": 現在値,
      "targetValue": 目標値,
      "achievementRate": 達成率,
      "trend": "up/down/stable",
      "status": "good/warning/critical"
    }
  ],
  "insights": ["洞察1", "洞察2"],
  "recommendations": ["推奨事項1", "推奨事項2"]
}`,
    variables: [
      { name: 'fiscalYear', description: '対象年度', required: true },
      { name: 'month', description: '対象月', required: true },
      { name: 'kpiData', description: 'KPIデータ', required: true },
      { name: 'targets', description: '目標値', required: false },
    ],
  },

  BOARD_REPORT: {
    analysisType: 'BOARD_REPORT',
    name: '取締役会報告',
    description: '取締役会向けレポートの分析セクション',
    isDefault: true,
    isActive: true,
    systemPrompt: `あなたはCFOとして取締役会に報告する立場で分析します。
経営陣が意思決定できるよう、簡潔かつ重要な情報を提供してください。
リスクとチャンスを客観的に評価し、具体的なアクションを提案してください。`,
    userPromptTemplate: `以下のデータに基づき、取締役会報告用の分析セクションを作成してください。

## 対象期間
- 年度: {{fiscalYear}}
- 月: {{month}}

## 財務サマリー
{{financialSummary}}

## キャッシュポジション
{{cashPosition}}

## 主要KPI
{{keyMetrics}}

## 前月からの変化
{{changesFromLastMonth}}

以下の形式で回答：
{
  "summary": "エグゼクティブサマリー（300文字以内）",
  "keyHighlights": ["ハイライト1", "ハイライト2", "ハイライト3"],
  "risks": [
    {
      "description": "リスクの説明",
      "severity": "high/medium/low",
      "mitigation": "軽減策"
    }
  ],
  "opportunities": [
    {
      "description": "機会の説明",
      "potential": "潜在影響",
      "recommendedAction": "推奨アクション"
    }
  ],
  "recommendations": ["推奨事項1", "推奨事項2"],
  "nextMonthFocus": "来月の注力ポイント"
}`,
    variables: [
      { name: 'fiscalYear', description: '対象年度', required: true },
      { name: 'month', description: '対象月', required: true },
      { name: 'financialSummary', description: '財務サマリー', required: true },
      { name: 'cashPosition', description: 'キャッシュポジション', required: true },
      { name: 'keyMetrics', description: '主要KPI', required: true },
      { name: 'changesFromLastMonth', description: '前月からの変化', required: false },
    ],
  },
}

export async function getPrompt(
  analysisType: AnalysisType,
  companyId?: string
): Promise<AnalysisPromptDetail> {
  if (companyId) {
    const customPrompt = await prisma.analysisPrompt.findFirst({
      where: { companyId, analysisType, isActive: true },
    })
    if (customPrompt) {
      return {
        id: customPrompt.id,
        companyId: customPrompt.companyId,
        analysisType: customPrompt.analysisType as AnalysisType,
        name: customPrompt.name,
        description: customPrompt.description,
        systemPrompt: customPrompt.systemPrompt,
        userPromptTemplate: customPrompt.userPromptTemplate,
        variables: JSON.parse(customPrompt.variables),
        isActive: customPrompt.isActive,
        isDefault: customPrompt.isDefault,
        version: customPrompt.version,
        parentPromptId: customPrompt.parentPromptId,
      }
    }
  }

  const defaultPrompt = DEFAULT_PROMPTS[analysisType]
  if (!defaultPrompt) {
    throw new Error(`Unknown analysis type: ${analysisType}`)
  }

  return {
    id: 'default',
    companyId: null,
    ...defaultPrompt,
    version: 1,
    parentPromptId: null,
  }
}

export async function getPromptsByType(
  analysisType: AnalysisType,
  companyId?: string
): Promise<AnalysisPromptDetail[]> {
  const where: { analysisType: string; companyId?: string | null; isActive: boolean } = {
    analysisType,
    isActive: true,
  }

  if (companyId) {
    where.companyId = companyId
  } else {
    where.companyId = null
  }

  const prompts = await prisma.analysisPrompt.findMany({
    where,
    orderBy: { version: 'desc' },
  })

  return prompts.map((p) => ({
    id: p.id,
    companyId: p.companyId,
    analysisType: p.analysisType as AnalysisType,
    name: p.name,
    description: p.description,
    systemPrompt: p.systemPrompt,
    userPromptTemplate: p.userPromptTemplate,
    variables: JSON.parse(p.variables),
    isActive: p.isActive,
    isDefault: p.isDefault,
    version: p.version,
    parentPromptId: p.parentPromptId,
  }))
}

export async function setPrompt(
  analysisType: AnalysisType,
  companyId: string,
  prompt: {
    name: string
    description?: string
    systemPrompt: string
    userPromptTemplate: string
    variables: PromptVariable[]
  }
): Promise<AnalysisPromptDetail> {
  await prisma.analysisPrompt.updateMany({
    where: { companyId, analysisType, isActive: true },
    data: { isActive: false },
  })

  const newPrompt = await prisma.analysisPrompt.create({
    data: {
      companyId,
      analysisType,
      name: prompt.name,
      description: prompt.description || null,
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
      variables: JSON.stringify(prompt.variables),
      isActive: true,
      isDefault: false,
      version: 1,
    },
  })

  return {
    id: newPrompt.id,
    companyId: newPrompt.companyId,
    analysisType: newPrompt.analysisType as AnalysisType,
    name: newPrompt.name,
    description: newPrompt.description,
    systemPrompt: newPrompt.systemPrompt,
    userPromptTemplate: newPrompt.userPromptTemplate,
    variables: JSON.parse(newPrompt.variables),
    isActive: newPrompt.isActive,
    isDefault: newPrompt.isDefault,
    version: newPrompt.version,
    parentPromptId: newPrompt.parentPromptId,
  }
}

export async function resetToDefault(analysisType: AnalysisType, companyId: string): Promise<void> {
  await prisma.analysisPrompt.updateMany({
    where: { companyId, analysisType },
    data: { isActive: false },
  })
}

export function renderPrompt(
  prompt: AnalysisPromptDetail,
  variables: Record<string, string>
): RenderedPrompt {
  let userPrompt = prompt.userPromptTemplate

  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }

  return {
    systemPrompt: prompt.systemPrompt,
    userPrompt,
  }
}

export async function initializeDefaultPrompts(): Promise<number> {
  let count = 0

  for (const [analysisType, prompt] of Object.entries(DEFAULT_PROMPTS)) {
    const existing = await prisma.analysisPrompt.findFirst({
      where: {
        analysisType,
        isDefault: true,
        companyId: null,
      },
    })

    if (!existing) {
      await prisma.analysisPrompt.create({
        data: {
          companyId: null,
          analysisType,
          name: prompt.name,
          description: prompt.description || null,
          systemPrompt: prompt.systemPrompt,
          userPromptTemplate: prompt.userPromptTemplate,
          variables: JSON.stringify(prompt.variables),
          isActive: true,
          isDefault: true,
          version: 1,
        },
      })
      count++
    }
  }

  return count
}

export function getAnalysisTypes(): { type: AnalysisType; name: string; description: string }[] {
  return [
    {
      type: 'FINANCIAL_ANALYSIS',
      name: '財務分析',
      description: 'BS/PL/CFデータに基づく総合的な財務分析',
    },
    { type: 'JOURNAL_AUDIT', name: '仕訳監査', description: '個別仕訳の整合性チェック' },
    { type: 'BUDGET_VARIANCE', name: '予実差異分析', description: '予算と実績の差異分析' },
    {
      type: 'CASH_FLOW_FORECAST',
      name: 'キャッシュフロー予測',
      description: '将来のキャッシュフロー予測',
    },
    { type: 'KPI_ANALYSIS', name: 'KPI分析', description: '経営指標の分析と評価' },
    {
      type: 'BOARD_REPORT',
      name: '取締役会報告',
      description: '取締役会向けレポートの分析セクション',
    },
  ]
}
