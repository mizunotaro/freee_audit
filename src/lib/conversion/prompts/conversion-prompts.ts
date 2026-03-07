import type { ChartOfAccountItem, ChartOfAccounts } from '@/types/conversion'

interface FormatSourceAccountsOptions {
  accounts: ChartOfAccountItem[]
}

interface FormatTargetCoaOptions {
  coa: ChartOfAccounts
}

function formatSourceAccounts(options: FormatSourceAccountsOptions): string {
  return options.accounts.map((a) => `- ${a.code}: ${a.name} (${a.nameEn})`).join('\n')
}

function formatTargetCoa(options: FormatTargetCoaOptions): string {
  return options.coa.items.map((a) => `- ${a.code}: ${a.name} (${a.nameEn})`).join('\n')
}

interface BalanceSheetItem {
  code: string
  name: string
  nameEn: string
  amount: number
}

interface BalanceSheet {
  asOfDate: Date
  assets: BalanceSheetItem[]
  liabilities: BalanceSheetItem[]
  equity: BalanceSheetItem[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}

interface ProfitLossItem {
  code: string
  name: string
  nameEn: string
  amount: number
}

interface ProfitLoss {
  periodStart: Date
  periodEnd: Date
  revenue: ProfitLossItem[]
  costOfSales: ProfitLossItem[]
  sgaExpenses: ProfitLossItem[]
  nonOperatingIncome: ProfitLossItem[]
  nonOperatingExpenses: ProfitLossItem[]
  grossProfit: number
  operatingIncome: number
  ordinaryIncome: number
  incomeBeforeTax: number
  netIncome: number
}

function formatBS(bs: BalanceSheet): string {
  const formatItems = (items: BalanceSheetItem[]) =>
    items.map((i) => `  ${i.code}: ${i.name} = ${i.amount}`).join('\n')

  return `【資産】
${formatItems(bs.assets)}
合計: ${bs.totalAssets}

【負債】
${formatItems(bs.liabilities)}
合計: ${bs.totalLiabilities}

【株主資本】
${formatItems(bs.equity)}
合計: ${bs.totalEquity}`
}

function formatPL(pl: ProfitLoss): string {
  const formatItems = (items: ProfitLossItem[]) =>
    items.map((i) => `  ${i.code}: ${i.name} = ${i.amount}`).join('\n')

  return `【売上高】
${formatItems(pl.revenue)}
売上総利益: ${pl.grossProfit}

【売上原価】
${formatItems(pl.costOfSales)}

【販売費及び一般管理費】
${formatItems(pl.sgaExpenses)}
営業利益: ${pl.operatingIncome}

【営業外収益】
${formatItems(pl.nonOperatingIncome)}

【営業外費用】
${formatItems(pl.nonOperatingExpenses)}
経常利益: ${pl.ordinaryIncome}
税引前当期純利益: ${pl.incomeBeforeTax}
当期純利益: ${pl.netIncome}`
}

interface ConversionProject {
  id: string
  name: string
  targetStandard: 'USGAAP' | 'IFRS'
  periodStart: Date
  periodEnd: Date
  statistics?: {
    totalAccounts: number
    mappedAccounts: number
    reviewRequiredCount: number
    totalJournals: number
    convertedJournals: number
    adjustingEntryCount: number
    averageConfidence: number
  }
}

interface ConversionResult {
  id: string
  projectId: string
  balanceSheet?: BalanceSheet
  profitLoss?: ProfitLoss
  adjustingEntries?: Array<{
    id: string
    type: string
    description: string
    descriptionEn?: string
    lines: Array<{
      accountCode: string
      accountName: string
      debit: number
      credit: number
    }>
    ifrsReference?: string
    usgaapReference?: string
    aiSuggested: boolean
    isApproved: boolean
  }>
}

function formatResultSummary(result: ConversionResult): string {
  const parts: string[] = []

  if (result.balanceSheet) {
    parts.push(
      `貸借対照表: 資産 ${result.balanceSheet.totalAssets}, 負債 ${result.balanceSheet.totalLiabilities}, 資本 ${result.balanceSheet.totalEquity}`
    )
  }

  if (result.profitLoss) {
    parts.push(`損益計算書: 当期純利益 ${result.profitLoss.netIncome}`)
  }

  if (result.adjustingEntries) {
    parts.push(`調整仕訳数: ${result.adjustingEntries.length}`)
  }

  return parts.join('\n')
}

function formatConvertedStatements(result: ConversionResult): string {
  const parts: string[] = []

  if (result.balanceSheet) {
    parts.push(formatBS(result.balanceSheet))
  }

  if (result.profitLoss) {
    parts.push(formatPL(result.profitLoss))
  }

  return parts.join('\n\n')
}

function formatAdjustingEntries(entries: ConversionResult['adjustingEntries']): string {
  if (!entries || entries.length === 0) {
    return '調整仕訳なし'
  }

  return entries
    .map((e) => {
      const lines = e.lines
        .map((l) => `  ${l.accountCode}: ${l.accountName} 借方${l.debit} / 貸方${l.credit}`)
        .join('\n')
      return `【${e.description}】\n${lines}\n参照: ${e.ifrsReference || e.usgaapReference || 'なし'}`
    })
    .join('\n\n')
}

function formatProject(project: ConversionProject): string {
  const stats = project.statistics
    ? `統計: 総勘定科目${project.statistics.totalAccounts}, マッピング済み${project.statistics.mappedAccounts}, 信頼度${project.statistics.averageConfidence.toFixed(2)}`
    : '統計なし'

  return `プロジェクト: ${project.name}
ターゲット基準: ${project.targetStandard}
期間: ${project.periodStart} - ${project.periodEnd}
${stats}`
}

function formatResult(result: ConversionResult): string {
  return formatResultSummary(result)
}

export const CONVERSION_PROMPTS = {
  systemPrompt: `あなたはUSGAAP、IFRS、JGAAPに精通した公認会計士・監査法人の専門家です。
日本の会計基準で作成された財務情報をUSGAAPまたはIFRSに変換するアドバイスを行います。

専門知識:
- 日本基準（JGAAP）の詳細な理解
- US GAAP（ASC）の各標準への精通
- IFRS（IAS/IFRS）の各標準への精通
- 3基準間の主な差異と変換時の注意点
- 実務的な変換プロセスの経験

回答時は以下を遵守してください:
1. 具体的な会計基準の参照を含める（ASC番号、IAS番号等）
2. 変換の理由と影響を明確に説明する
3. 必要な調整仕訳を具体的に提案する
4. リスクと注意事項を指摘する
5. 不確実な点は明示し、追加確認事項を提示する`,

  createMappingSuggestionPrompt: (
    sourceAccounts: ChartOfAccountItem[],
    targetCoa: ChartOfAccounts,
    targetStandard: 'USGAAP' | 'IFRS'
  ): string => {
    return `以下のJGAAP勘定科目を${targetStandard}の勘定科目にマッピングしてください。

【ソース勘定科目】
${formatSourceAccounts({ accounts: sourceAccounts })}

【ターゲット勘定科目表】
${formatTargetCoa({ coa: targetCoa })}

各ソース科目について以下をJSON形式で回答:
{
  "suggestions": [
    {
      "sourceCode": "xxx",
      "sourceName": "xxx",
      "targetCode": "xxx",
      "targetName": "xxx",
      "confidence": 0.95,
      "reasoning": "マッピング理由",
      "alternatives": [
        { "code": "xxx", "name": "xxx", "confidence": 0.80 }
      ]
    }
  ]
}`
  },

  createAdjustmentSuggestionPrompt: (
    sourceData: { balanceSheet: BalanceSheet; profitLoss: ProfitLoss },
    targetStandard: 'USGAAP' | 'IFRS'
  ): string => {
    return `以下のJGAAP財務データを${targetStandard}に変換する際に必要な調整仕訳を提案してください。

【貸借対照表】
${formatBS(sourceData.balanceSheet)}

【損益計算書】
${formatPL(sourceData.profitLoss)}

主な${targetStandard}との差異について、必要な調整をJSON形式で回答:
{
  "adjustments": [
    {
      "type": "adjustment_type",
      "priority": "high|medium|low",
      "title": "調整名",
      "description": "調整の説明",
      "estimatedImpact": {
        "assetChange": 0,
        "liabilityChange": 0,
        "equityChange": 0,
        "netIncomeChange": 0
      },
      "reasoning": "調整が必要な理由",
      "references": ["ASC xxx", "IAS xx"]
    }
  ]
}`
  },

  createRiskAssessmentPrompt: (project: ConversionProject, result: ConversionResult): string => {
    const mappingCompleteRate = project.statistics
      ? ((project.statistics.mappedAccounts / project.statistics.totalAccounts) * 100).toFixed(1)
      : '0'

    const unmappedAccountCount = project.statistics
      ? project.statistics.totalAccounts - project.statistics.mappedAccounts
      : 0

    return `以下の会計基準変換プロジェクトのリスクを評価してください。

【プロジェクト情報】
- 変換元基準: JGAAP
- 変換先基準: ${project.targetStandard}
- 対象期間: ${project.periodStart} - ${project.periodEnd}
- マッピング完了率: ${mappingCompleteRate}%
- 未マッピング勘定数: ${unmappedAccountCount}

【変換結果サマリー】
${formatResultSummary(result)}

リスク評価をJSON形式で回答:
{
  "risks": [
    {
      "category": "カテゴリ",
      "riskLevel": "low|medium|high",
      "description": "リスクの説明",
      "mitigationSuggestion": "緩和策"
    }
  ]
}`
  },

  createDisclosureGenerationPrompt: (
    result: ConversionResult,
    targetStandard: 'USGAAP' | 'IFRS'
  ): string => {
    return `以下の${targetStandard}変換結果に基づき、開示注記を生成してください。

【変換後財務諸表】
${formatConvertedStatements(result)}

【実施した調整仕訳】
${formatAdjustingEntries(result.adjustingEntries)}

${targetStandard}の開示要件に従い、必要な注記をJSON形式で回答:
{
  "disclosures": [
    {
      "category": "注記カテゴリ",
      "title": "注記タイトル",
      "titleEn": "Title in English",
      "content": "注記内容（日本語）",
      "contentEn": "Content in English",
      "standardReference": "ASC xxx / IAS xx"
    }
  ]
}`
  },

  createQualityReviewPrompt: (project: ConversionProject, result: ConversionResult): string => {
    return `以下の会計基準変換結果の品質をレビューしてください。

【変換プロジェクト】
${formatProject(project)}

【変換結果】
${formatResult(result)}

品質レビューをJSON形式で回答:
{
  "overallScore": 85,
  "categories": {
    "completeness": 90,
    "accuracy": 85,
    "compliance": 80,
    "documentation": 85
  },
  "issues": [
    {
      "severity": "high|medium|low",
      "category": "カテゴリ",
      "description": "問題の説明",
      "affectedItems": ["項目1", "項目2"],
      "suggestedAction": "推奨アクション"
    }
  ],
  "recommendations": ["推奨事項1", "推奨事項2"]
}`
  },
}

export type { BalanceSheet, ProfitLoss, ConversionProject, ConversionResult }
