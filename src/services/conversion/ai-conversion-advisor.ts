import { createAIProviderFromEnv, AIProvider } from '@/lib/integrations/ai'
import { prisma } from '@/lib/db'
import { CONVERSION_PROMPTS } from '@/lib/conversion/prompts/conversion-prompts'
import { aiResponseParser, QualityReview, QualityIssue } from '@/lib/conversion/ai-response-parser'
import type {
  ChartOfAccountItem,
  ChartOfAccounts,
  MappingSuggestion,
  AdjustmentRecommendation,
  RiskAssessment,
  AIConversionAnalysis,
  DisclosureNote,
  ConversionProject,
  ConversionResult,
} from '@/types/conversion'

const AI_TIMEOUT_MS = 60000
const MAX_ACCOUNTS_PER_REQUEST = 50

interface MockResponses {
  mappingSuggestions: Array<{
    sourceCode: string
    targetCode: string
    confidence: number
    reasoning: string
  }>
  adjustments: Array<{
    type: string
    priority: string
    title: string
  }>
}

const MOCK_RESPONSES: MockResponses = {
  mappingSuggestions: [
    {
      sourceCode: '1000',
      targetCode: '1100',
      confidence: 0.95,
      reasoning: '現金はCash and Cash Equivalentsに直接対応します',
    },
    {
      sourceCode: '1100',
      targetCode: '1200',
      confidence: 0.9,
      reasoning: '普通預金はCash in Bankに対応します',
    },
    {
      sourceCode: '1200',
      targetCode: '1300',
      confidence: 0.85,
      reasoning: '売掛金はAccounts Receivableに対応します',
    },
  ],
  adjustments: [
    {
      type: 'lease_classification',
      priority: 'high',
      title: 'リース会計の調整',
    },
    {
      type: 'revenue_recognition',
      priority: 'medium',
      title: '収益認識の調整',
    },
    {
      type: 'deferred_tax',
      priority: 'medium',
      title: '繰延税金の調整',
    },
  ],
}

export class AIConversionAdvisor {
  private aiProvider: AIProvider | null
  private isMockMode: boolean

  constructor() {
    this.isMockMode = process.env.AI_MOCK_MODE === 'true'
    this.aiProvider = createAIProviderFromEnv()
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
      console.error('[AIConversionAdvisor] AI call failed:', error)
      throw error
    }
  }

  private getMockResponse(prompt: string): string {
    if (prompt.includes('品質')) {
      return JSON.stringify({
        overallScore: 85,
        categories: {
          completeness: 90,
          accuracy: 85,
          compliance: 80,
          documentation: 85,
        },
        issues: [
          {
            severity: 'medium',
            category: 'マッピング',
            description: '一部の勘定科目の信頼度が低い',
            affectedItems: ['科目A', '科目B'],
            suggestedAction: '手動レビューを推奨',
          },
        ],
        recommendations: ['全体的な品質は良好です', '低信頼度のマッピングを確認してください'],
      })
    }

    if (prompt.includes('注記') || prompt.includes('開示')) {
      return JSON.stringify({
        disclosures: [
          {
            category: 'significant_accounting_policies',
            title: '重要な会計方針',
            titleEn: 'Significant Accounting Policies',
            content: '重要な会計方針の開示内容',
            contentEn: 'Disclosure content for significant accounting policies',
            standardReference: 'ASC 235 / IAS 1',
          },
        ],
      })
    }

    if (prompt.includes('リスク')) {
      return JSON.stringify({
        risks: [
          {
            category: 'マッピング精度',
            riskLevel: 'medium',
            description: '一部の勘定科目のマッピングに不確実性があります',
            mitigationSuggestion: '専門家によるレビューを推奨',
          },
          {
            category: '開示要件',
            riskLevel: 'low',
            description: '開示注記が不完全な可能性があります',
            mitigationSuggestion: '基準別の開示チェックリストを使用',
          },
        ],
      })
    }

    if (prompt.includes('調整仕訳') || (prompt.includes('調整') && prompt.includes('差異'))) {
      return JSON.stringify({
        adjustments: MOCK_RESPONSES.adjustments.map((a) => ({
          type: a.type,
          priority: a.priority,
          title: a.title,
          description: `${a.title}の説明`,
          estimatedImpact: {
            assetChange: 0,
            liabilityChange: 0,
            equityChange: 0,
            netIncomeChange: 0,
          },
          reasoning: `${a.title}が必要な理由`,
          references: ['ASC 842', 'IFRS 16'],
        })),
      })
    }

    if (prompt.includes('マッピング')) {
      return JSON.stringify({
        suggestions: MOCK_RESPONSES.mappingSuggestions.map((m) => ({
          sourceCode: m.sourceCode,
          sourceName: `科目${m.sourceCode}`,
          targetCode: m.targetCode,
          targetName: `Account ${m.targetCode}`,
          confidence: m.confidence,
          reasoning: m.reasoning,
          alternatives: [],
        })),
      })
    }

    return '{}'
  }

  async suggestMappings(
    sourceAccounts: ChartOfAccountItem[],
    targetCoa: ChartOfAccounts,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<MappingSuggestion[]> {
    const chunks = this.chunkArray(sourceAccounts, MAX_ACCOUNTS_PER_REQUEST)
    const allSuggestions: MappingSuggestion[] = []

    for (const chunk of chunks) {
      const prompt = CONVERSION_PROMPTS.createMappingSuggestionPrompt(
        chunk,
        targetCoa,
        targetStandard
      )

      const response = await this.callAI(prompt)
      const result = aiResponseParser.parseMappingSuggestions(response)

      if (result.ok) {
        allSuggestions.push(...result.value)
      } else {
        console.error('[AIConversionAdvisor] Failed to parse mapping suggestions:', result.error)
      }
    }

    return allSuggestions
  }

  async suggestAdjustments(
    sourceData: {
      balanceSheet: {
        asOfDate: Date
        assets: Array<{ code: string; name: string; nameEn: string; amount: number }>
        liabilities: Array<{ code: string; name: string; nameEn: string; amount: number }>
        equity: Array<{ code: string; name: string; nameEn: string; amount: number }>
        totalAssets: number
        totalLiabilities: number
        totalEquity: number
      }
      profitLoss: {
        periodStart: Date
        periodEnd: Date
        revenue: Array<{ code: string; name: string; nameEn: string; amount: number }>
        costOfSales: Array<{ code: string; name: string; nameEn: string; amount: number }>
        sgaExpenses: Array<{ code: string; name: string; nameEn: string; amount: number }>
        nonOperatingIncome: Array<{ code: string; name: string; nameEn: string; amount: number }>
        nonOperatingExpenses: Array<{ code: string; name: string; nameEn: string; amount: number }>
        grossProfit: number
        operatingIncome: number
        ordinaryIncome: number
        incomeBeforeTax: number
        netIncome: number
      }
    },
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<AdjustmentRecommendation[]> {
    const prompt = CONVERSION_PROMPTS.createAdjustmentSuggestionPrompt(
      sourceData as Parameters<typeof CONVERSION_PROMPTS.createAdjustmentSuggestionPrompt>[0],
      targetStandard
    )

    const response = await this.callAI(prompt)
    const result = aiResponseParser.parseAdjustmentRecommendations(response)

    if (!result.ok) {
      console.error(
        '[AIConversionAdvisor] Failed to parse adjustment recommendations:',
        result.error
      )
      return []
    }

    return result.value
  }

  async assessRisks(
    project: ConversionProject,
    result: ConversionResult
  ): Promise<RiskAssessment[]> {
    const prompt = CONVERSION_PROMPTS.createRiskAssessmentPrompt(
      project as Parameters<typeof CONVERSION_PROMPTS.createRiskAssessmentPrompt>[0],
      result as Parameters<typeof CONVERSION_PROMPTS.createRiskAssessmentPrompt>[1]
    )

    const response = await this.callAI(prompt)
    const parseResult = aiResponseParser.parseRiskAssessments(response)

    if (!parseResult.ok) {
      console.error('[AIConversionAdvisor] Failed to parse risk assessments:', parseResult.error)
      return []
    }

    return parseResult.value
  }

  async analyzeConversion(projectId: string): Promise<AIConversionAnalysis> {
    const project = await this.getProject(projectId)
    const result = await this.getConversionResult(projectId)

    const [mappingSuggestions, adjustmentRecommendations, riskAssessments] = await Promise.all([
      this.suggestMappingsFromProject(project),
      this.suggestAdjustmentsFromProject(project),
      this.assessRisks(project, result),
    ])

    const qualityReview = await this.reviewQuality(result)

    return {
      id: `analysis-${projectId}-${Date.now()}`,
      projectId,
      mappingSuggestions,
      adjustmentRecommendations,
      riskAssessments,
      qualityScore: qualityReview.overallScore,
      generatedAt: new Date(),
      modelUsed: this.isMockMode ? 'mock' : this.aiProvider?.name || 'unknown',
    }
  }

  private async suggestMappingsFromProject(
    project: ConversionProject
  ): Promise<MappingSuggestion[]> {
    const sourceCoa = await this.getSourceCoa(project.companyId)
    const targetCoa = await this.getTargetCoa(project.targetCoaId)

    if (!sourceCoa || !targetCoa) {
      return []
    }

    return this.suggestMappings(
      sourceCoa.items,
      targetCoa,
      project.targetStandard as 'USGAAP' | 'IFRS'
    )
  }

  private async suggestAdjustmentsFromProject(
    project: ConversionProject
  ): Promise<AdjustmentRecommendation[]> {
    const result = await this.getConversionResult(project.id)

    if (!result.balanceSheet || !result.profitLoss) {
      return []
    }

    return this.suggestAdjustments(
      {
        balanceSheet: result.balanceSheet,
        profitLoss: result.profitLoss,
      },
      project.targetStandard as 'USGAAP' | 'IFRS'
    )
  }

  async generateDisclosures(
    projectId: string,
    targetStandard: 'USGAAP' | 'IFRS'
  ): Promise<DisclosureNote[]> {
    const result = await this.getConversionResult(projectId)

    const prompt = CONVERSION_PROMPTS.createDisclosureGenerationPrompt(
      result as Parameters<typeof CONVERSION_PROMPTS.createDisclosureGenerationPrompt>[0],
      targetStandard
    )

    const response = await this.callAI(prompt)
    const parseResult = aiResponseParser.parseDisclosureNotes(response)

    if (!parseResult.ok) {
      console.error('[AIConversionAdvisor] Failed to parse disclosure notes:', parseResult.error)
      return []
    }

    return parseResult.value.map((note, index) => ({
      ...note,
      id: `disclosure-${projectId}-${index}`,
      order: index + 1,
      isGenerated: true,
    }))
  }

  async reviewQuality(result: ConversionResult): Promise<QualityReview> {
    const project = await this.getProjectFromResult(result)

    const prompt = CONVERSION_PROMPTS.createQualityReviewPrompt(
      project as Parameters<typeof CONVERSION_PROMPTS.createQualityReviewPrompt>[0],
      result as Parameters<typeof CONVERSION_PROMPTS.createQualityReviewPrompt>[1]
    )

    const response = await this.callAI(prompt)
    const parseResult = aiResponseParser.parseQualityReview(response)

    if (!parseResult.ok) {
      console.error('[AIConversionAdvisor] Failed to parse quality review:', parseResult.error)
      return {
        overallScore: 0,
        categories: {
          completeness: 0,
          accuracy: 0,
          compliance: 0,
          documentation: 0,
        },
        issues: [
          {
            severity: 'critical',
            category: 'AI解析',
            description: '品質レビューの解析に失敗しました',
            affectedItems: [],
            suggestedAction: 'AIプロバイダーの設定を確認してください',
          },
        ],
        recommendations: [],
      }
    }

    return parseResult.value
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private async getProject(projectId: string): Promise<ConversionProject> {
    const project = await prisma.conversionProject.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    return project as unknown as ConversionProject
  }

  private async getProjectFromResult(result: ConversionResult): Promise<ConversionProject> {
    return this.getProject(result.projectId)
  }

  private async getConversionResult(projectId: string): Promise<ConversionResult> {
    const result = await prisma.conversionResult.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    if (!result) {
      return {
        id: `empty-${projectId}`,
        projectId,
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }
    }

    return result as unknown as ConversionResult
  }

  private async getSourceCoa(companyId: string): Promise<ChartOfAccounts | null> {
    const coa = await prisma.chartOfAccount.findFirst({
      where: {
        companyId,
        standardId: 'jgaap',
        isActive: true,
      },
      include: {
        items: true,
      },
    })

    return coa as unknown as ChartOfAccounts | null
  }

  private async getTargetCoa(coaId: string): Promise<ChartOfAccounts | null> {
    const coa = await prisma.chartOfAccount.findUnique({
      where: { id: coaId },
      include: {
        items: true,
      },
    })

    return coa as unknown as ChartOfAccounts | null
  }
}

export const aiConversionAdvisor = new AIConversionAdvisor()

export type { QualityReview, QualityIssue }
