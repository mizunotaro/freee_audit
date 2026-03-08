import { createAIProviderFromEnv, AIProvider } from '@/lib/integrations/ai'
import type {
  ChartOfAccountItem,
  AdjustingEntry,
  JournalConversion,
  ConvertedBalanceSheet,
  ConvertedProfitLoss,
  GeneratedRationale,
  AccountMapping,
} from '@/types/conversion'

const AI_TIMEOUT_MS = 60000

interface SourceFinancialData {
  balanceSheet?: ConvertedBalanceSheet
  profitLoss?: ConvertedProfitLoss
}

interface ComparisonItem {
  code: string
  sourceAmount: number
  targetAmount: number
  difference: number
  description?: string
}

export class RationaleGenerator {
  private aiProvider: AIProvider | null
  private isMockMode: boolean

  constructor() {
    this.isMockMode = process.env.AI_MOCK_MODE === 'true'
    this.aiProvider = createAIProviderFromEnv()
  }

  async generateMappingRationale(
    sourceAccount: ChartOfAccountItem,
    targetAccount: ChartOfAccountItem,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<GeneratedRationale> {
    const prompt = this.createMappingRationalePrompt(sourceAccount, targetAccount, targetStandard)

    const response = await this.callAI(prompt)
    const parsed = this.parseRationaleResponse(response)

    if (parsed) {
      return parsed
    }

    return this.getDefaultMappingRationale(sourceAccount, targetAccount, targetStandard)
  }

  async generateAdjustmentRationale(
    adjustment: AdjustingEntry,
    sourceData: SourceFinancialData
  ): Promise<GeneratedRationale> {
    const prompt = this.createAdjustmentRationalePrompt(adjustment, sourceData)

    const response = await this.callAI(prompt)
    const parsed = this.parseRationaleResponse(response)

    if (parsed) {
      return parsed
    }

    return this.getDefaultAdjustmentRationale(adjustment)
  }

  async generateJournalConversionRationale(
    sourceJournal: JournalConversion,
    mappings: AccountMapping[]
  ): Promise<GeneratedRationale> {
    const prompt = this.createJournalConversionRationalePrompt(sourceJournal, mappings)

    const response = await this.callAI(prompt)
    const parsed = this.parseRationaleResponse(response)

    if (parsed) {
      return parsed
    }

    return this.getDefaultJournalConversionRationale(sourceJournal)
  }

  async generateFSConversionRationale(
    sourceFS: ConvertedBalanceSheet | ConvertedProfitLoss,
    targetFS: ConvertedBalanceSheet | ConvertedProfitLoss,
    differences: ComparisonItem[]
  ): Promise<GeneratedRationale> {
    const prompt = this.createFSConversionRationalePrompt(sourceFS, targetFS, differences)

    const response = await this.callAI(prompt)
    const parsed = this.parseRationaleResponse(response)

    if (parsed) {
      return parsed
    }

    return this.getDefaultFSConversionRationale(sourceFS, differences)
  }

  private async callAI(prompt: string): Promise<string> {
    if (this.isMockMode || !this.aiProvider) {
      return this.getMockResponse(prompt)
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout')), AI_TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([
        this.aiProvider.analyzeDocument({
          documentBase64: Buffer.from(prompt).toString('base64'),
          documentType: 'pdf',
          mimeType: 'text/plain',
        }),
        timeoutPromise,
      ])

      return result.rawText || ''
    } catch (error) {
      console.error('[RationaleGenerator] AI call failed:', error)
      throw error
    }
  }

  private getMockResponse(prompt: string): string {
    if (prompt.includes('マッピング')) {
      return JSON.stringify({
        summary: 'JGAAPからUSGAAP/IFRSへの勘定科目マッピングの根拠',
        summaryEn: 'Rationale for account mapping from JGAAP to USGAAP/IFRS',
        detailedExplanation:
          'このマッピングは、両基準における科目の定義と分類に基づいています。JGAAPとUSGAAP/IFRSでは科目の表示方法が異なる場合がありますが、経済的実質は同一です。',
        detailedExplanationEn:
          'This mapping is based on the definitions and classifications of accounts under both standards. While presentation may differ between JGAAP and USGAAP/IFRS, the economic substance is the same.',
        sourceReferenceNumbers: ['会計基準第26号'],
        targetReferenceNumbers: ['ASC 606', 'IFRS 15'],
        confidence: 0.95,
      })
    }

    if (prompt.includes('調整')) {
      return JSON.stringify({
        summary: 'JGAAPとUSGAAP/IFRSの差異に伴う調整仕訳の根拠',
        summaryEn: 'Rationale for adjusting entry due to differences between JGAAP and USGAAP/IFRS',
        detailedExplanation:
          'この調整仕訳は、JGAAPとUSGAAP/IFRSの会計処理の差異を解消するために必要です。主な差異は、資産/負債の認識基準、測定方法、表示方法にあります。',
        detailedExplanationEn:
          'This adjusting entry is required to reconcile differences in accounting treatment between JGAAP and USGAAP/IFRS. Key differences relate to asset/liability recognition criteria, measurement methods, and presentation.',
        sourceReferenceNumbers: ['会計基準第14号'],
        targetReferenceNumbers: ['ASC 842', 'IFRS 16'],
        impactAmount: 1000000,
        impactDirection: 'increase',
        confidence: 0.9,
      })
    }

    return JSON.stringify({
      summary: '変換根拠の説明',
      summaryEn: 'Explanation of conversion rationale',
      detailedExplanation: '詳細な変換根拠の説明',
      detailedExplanationEn: 'Detailed explanation of conversion rationale',
      sourceReferenceNumbers: [],
      targetReferenceNumbers: [],
      confidence: 0.8,
    })
  }

  private createMappingRationalePrompt(
    sourceAccount: ChartOfAccountItem,
    targetAccount: ChartOfAccountItem,
    targetStandard: 'USGAAP' | 'IFRS'
  ): string {
    return `以下の勘定科目マッピングについて、JGAAPから${targetStandard}への変換根拠を詳細に説明してください。

【ソース勘定科目】
コード: ${sourceAccount.code}
名称: ${sourceAccount.name} (${sourceAccount.nameEn})
カテゴリ: ${sourceAccount.category}

【ターゲット勘定科目】
コード: ${targetAccount.code}
名称: ${targetAccount.name} (${targetAccount.nameEn})
カテゴリ: ${targetAccount.category}

以下の形式で回答してください:
{
  "summary": "簡潔な要約（日本語、1-2文）",
  "summaryEn": "Summary in English",
  "detailedExplanation": "詳細な説明（日本語、会計基準の参照を含む）",
  "detailedExplanationEn": "Detailed explanation in English",
  "sourceReferenceNumbers": ["JGAAP参照番号"],
  "targetReferenceNumbers": ["${targetStandard}参照番号"],
  "confidence": 0.95
}

説明には以下を含めてください:
1. 両基準での当該科目の定義・分類の違い
2. マッピングが適切である理由
3. 関連する会計基準の具体的な参照
4. 注意すべき点や制約事項`
  }

  private createAdjustmentRationalePrompt(
    adjustment: AdjustingEntry,
    sourceData: SourceFinancialData
  ): string {
    const linesDescription = adjustment.lines
      .map((l) => `${l.accountName}: 借方${l.debit} / 貸方${l.credit}`)
      .join('\n')

    const balanceSheetInfo = sourceData.balanceSheet
      ? `資産合計: ${sourceData.balanceSheet.totalAssets}
負債合計: ${sourceData.balanceSheet.totalLiabilities}
資本合計: ${sourceData.balanceSheet.totalEquity}`
      : 'N/A'

    const profitLossInfo = sourceData.profitLoss
      ? `売上高: ${sourceData.profitLoss.revenue.reduce((sum, r) => sum + r.amount, 0)}
営業利益: ${sourceData.profitLoss.operatingIncome}
当期純利益: ${sourceData.profitLoss.netIncome}`
      : 'N/A'

    return `以下の調整仕訳について、USGAAP/IFRSへの変換に必要な理由を詳細に説明してください。

【調整タイプ】
${adjustment.type}

【調整内容】
${adjustment.description}

【仕訳】
${linesDescription}

【変換前財務データ】
貸借対照表:
${balanceSheetInfo}

損益計算書:
${profitLossInfo}

以下の形式で回答:
{
  "summary": "...",
  "summaryEn": "...",
  "detailedExplanation": "...",
  "detailedExplanationEn": "...",
  "sourceReferenceNumbers": ["..."],
  "targetReferenceNumbers": ["..."],
  "impactAmount": 1000000,
  "impactDirection": "increase|decrease|reclassification",
  "confidence": 0.95
}

説明には以下を含めてください:
1. JGAAPとUSGAAP/IFRSの当該項目に関する主な差異
2. 調整が必要となる具体的な基準要件
3. 調整金額の算定根拠
4. 財務諸表への影響
5. 開示が必要な事項`
  }

  private createJournalConversionRationalePrompt(
    sourceJournal: JournalConversion,
    _mappings: AccountMapping[]
  ): string {
    const linesDescription = sourceJournal.lines
      .map(
        (l) =>
          `${l.sourceAccountName} -> ${l.targetAccountName}: 借方${l.debitAmount} / 貸方${l.creditAmount}`
      )
      .join('\n')

    return `以下の仕訳変換について、変換根拠を詳細に説明してください。

【ソース仕訳情報】
日付: ${sourceJournal.sourceDate}
説明: ${sourceJournal.sourceDescription}

【変換内容】
${linesDescription}

【マッピング信頼度】
${sourceJournal.mappingConfidence}

以下の形式で回答:
{
  "summary": "...",
  "summaryEn": "...",
  "detailedExplanation": "...",
  "detailedExplanationEn": "...",
  "sourceReferenceNumbers": ["..."],
  "targetReferenceNumbers": ["..."],
  "confidence": 0.95
}

説明には以下を含めてください:
1. 使用された勘定科目マッピングの根拠
2. 金額の変換方法
3. 特殊な処理が必要な場合の説明
4. レビューが必要な項目`
  }

  private createFSConversionRationalePrompt(
    sourceFS: ConvertedBalanceSheet | ConvertedProfitLoss,
    _targetFS: ConvertedBalanceSheet | ConvertedProfitLoss,
    differences: ComparisonItem[]
  ): string {
    const isBalanceSheet = 'totalAssets' in sourceFS
    const fsType = isBalanceSheet ? '貸借対照表' : '損益計算書'

    const differencesDescription = differences
      .slice(0, 10)
      .map((d) => `${d.code}: 差異 ${d.difference} (${d.description || ''})`)
      .join('\n')

    return `以下の${fsType}変換について、変換根拠を詳細に説明してください。

【変換タイプ】
${fsType}

【主な差異項目】
${differencesDescription}

以下の形式で回答:
{
  "summary": "...",
  "summaryEn": "...",
  "detailedExplanation": "...",
  "detailedExplanationEn": "...",
  "sourceReferenceNumbers": ["..."],
  "targetReferenceNumbers": ["..."],
  "impactAmount": 1000000,
  "impactDirection": "increase|decrease|reclassification",
  "confidence": 0.95
}

説明には以下を含めてください:
1. 主要な変換項目とその理由
2. JGAAPとUSGAAP/IFRSの表示方法の違い
3. 金額の再分類が発生する場合の説明
4. 開示が必要な事項`
  }

  private parseRationaleResponse(response: string): GeneratedRationale | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0])

      return {
        summary: parsed.summary || '',
        summaryEn: parsed.summaryEn || '',
        detailedExplanation: parsed.detailedExplanation || '',
        detailedExplanationEn: parsed.detailedExplanationEn || '',
        sourceReferenceNumbers: parsed.sourceReferenceNumbers || [],
        targetReferenceNumbers: parsed.targetReferenceNumbers || [],
        impactAmount: parsed.impactAmount,
        impactDirection: parsed.impactDirection,
        confidence: parsed.confidence || 0.8,
      }
    } catch {
      return null
    }
  }

  private getDefaultMappingRationale(
    sourceAccount: ChartOfAccountItem,
    targetAccount: ChartOfAccountItem,
    targetStandard: 'USGAAP' | 'IFRS'
  ): GeneratedRationale {
    return {
      summary: `${sourceAccount.name}を${targetAccount.name}にマッピング`,
      summaryEn: `Mapping ${sourceAccount.name} to ${targetAccount.name}`,
      detailedExplanation: `${sourceAccount.name}（${sourceAccount.category}）は、${targetStandard}では${targetAccount.name}（${targetAccount.category}）として表示されます。これは両基準での分類方法の違いによるものです。`,
      detailedExplanationEn: `${sourceAccount.name} (${sourceAccount.category}) is presented as ${targetAccount.name} (${targetAccount.category}) under ${targetStandard}. This is due to differences in classification between the standards.`,
      sourceReferenceNumbers: [],
      targetReferenceNumbers: [],
      confidence: 0.7,
    }
  }

  private getDefaultAdjustmentRationale(adjustment: AdjustingEntry): GeneratedRationale {
    const totalImpact = adjustment.lines.reduce((sum, l) => sum + l.debit - l.credit, 0)

    return {
      summary: `${adjustment.type}に伴う調整仕訳`,
      summaryEn: `Adjustment entry for ${adjustment.type}`,
      detailedExplanation: adjustment.description,
      detailedExplanationEn: adjustment.descriptionEn || adjustment.description,
      sourceReferenceNumbers: adjustment.ifrsReference ? [adjustment.ifrsReference] : [],
      targetReferenceNumbers: adjustment.usgaapReference ? [adjustment.usgaapReference] : [],
      impactAmount: Math.abs(totalImpact),
      impactDirection:
        totalImpact > 0 ? 'increase' : totalImpact < 0 ? 'decrease' : 'reclassification',
      confidence: 0.7,
    }
  }

  private getDefaultJournalConversionRationale(
    sourceJournal: JournalConversion
  ): GeneratedRationale {
    return {
      summary: `仕訳変換: ${sourceJournal.sourceDescription}`,
      summaryEn: `Journal conversion: ${sourceJournal.sourceDescription}`,
      detailedExplanation: `ソース仕訳の日付${sourceJournal.sourceDate}の仕訳を変換しました。マッピング信頼度: ${sourceJournal.mappingConfidence}`,
      detailedExplanationEn: `Converted journal entry dated ${sourceJournal.sourceDate}. Mapping confidence: ${sourceJournal.mappingConfidence}`,
      sourceReferenceNumbers: [],
      targetReferenceNumbers: [],
      confidence: sourceJournal.mappingConfidence,
    }
  }

  private getDefaultFSConversionRationale(
    sourceFS: ConvertedBalanceSheet | ConvertedProfitLoss,
    differences: ComparisonItem[]
  ): GeneratedRationale {
    const isBalanceSheet = 'totalAssets' in sourceFS
    const fsType = isBalanceSheet ? '貸借対照表' : '損益計算書'
    const totalDifference = differences.reduce((sum, d) => sum + d.difference, 0)

    return {
      summary: `${fsType}の変換`,
      summaryEn: `Conversion of ${isBalanceSheet ? 'Balance Sheet' : 'Income Statement'}`,
      detailedExplanation: `${fsType}をJGAAPからUSGAAP/IFRSに変換しました。${differences.length}項目に差異があります。`,
      detailedExplanationEn: `Converted ${isBalanceSheet ? 'Balance Sheet' : 'Income Statement'} from JGAAP to USGAAP/IFRS. ${differences.length} items have differences.`,
      sourceReferenceNumbers: [],
      targetReferenceNumbers: [],
      impactAmount: Math.abs(totalDifference),
      impactDirection:
        totalDifference > 0 ? 'increase' : totalDifference < 0 ? 'decrease' : 'reclassification',
      confidence: 0.8,
    }
  }
}

export const rationaleGenerator = new RationaleGenerator()
