import {
  type ImportAdvisorResponse,
  type ImportAdviceItem,
  type ImportAdvisorContext,
} from './types'
import { success, failure, type Result } from '@/types/result'
import { createAIProviderFromEnv } from '@/lib/integrations/ai/factory'

const IMPORT_ADVISOR_PROMPTS = {
  ja: `あなたは経験豊富な公認会計士として、財務データのインポートに関する専門的なアドバイスを提供します。
以下の基準に基づいて、簡潔で実用的なアドバイスを提供してください：

1. 正確性: データの正確性を確保するための確認事項
2. 完全性: 必要なデータがすべて含まれているかの確認
3. 整合性: データ間の整合性の確認
4. コンプライアンス: 会計基準や税法への準拠

回答は必ず以下のJSON形式で返してください：
{
  "summary": "要約（1-2文）",
  "advice": [
    {
      "type": "warning|suggestion|best_practice|compliance",
      "title": "タイトル",
      "description": "詳細説明",
      "action": "推奨アクション",
      "priority": "high|medium|low"
    }
  ]
}`,
  en: `You are an experienced CPA providing professional advice on financial data imports.
Provide concise and actionable advice based on the following criteria:

1. Accuracy: Verification items to ensure data accuracy
2. Completeness: Check that all required data is included
3. Consistency: Verify consistency between data elements
4. Compliance: Adherence to accounting standards and tax laws

Always respond in the following JSON format:
{
  "summary": "Summary (1-2 sentences)",
  "advice": [
    {
      "type": "warning|suggestion|best_practice|compliance",
      "title": "Title",
      "description": "Detailed description",
      "action": "Recommended action",
      "priority": "high|medium|low"
    }
  ]
}`,
}

interface AIResponse {
  summary: string
  advice: Array<{
    type: 'warning' | 'suggestion' | 'best_practice' | 'compliance'
    title: string
    description: string
    action?: string
    priority: 'high' | 'medium' | 'low'
  }>
}

const REQUEST_TIMEOUT_MS = 30000

export class ImportAdvisor {
  async getAdvice(context: ImportAdvisorContext): Promise<Result<ImportAdvisorResponse, Error>> {
    const startTime = Date.now()

    try {
      const provider = createAIProviderFromEnv()

      if (!provider) {
        return success(this.getFallbackAdvice(context, startTime))
      }

      const language = context.language
      const systemPrompt = IMPORT_ADVISOR_PROMPTS[language]
      const userPrompt = this.buildUserPrompt(context, language)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const response = await provider.generate({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          maxTokens: 1500,
        })

        clearTimeout(timeoutId)

        const content = response.content || ''
        const parsed = this.parseAIResponse(content, language)

        return success({
          success: true,
          advice: parsed.advice.map((item, idx) => ({
            id: `advice-${idx}`,
            type: item.type,
            title: item.title,
            titleJa: language === 'ja' ? item.title : item.title,
            description: item.description,
            descriptionJa: language === 'ja' ? item.description : item.description,
            action: item.action,
            actionJa: language === 'ja' ? item.action : item.action,
            priority: item.priority,
          })),
          summary: parsed.summary,
          summaryJa: language === 'ja' ? parsed.summary : parsed.summary,
          persona: 'cpa',
          confidence: this.calculateConfidence(context),
          processingTimeMs: Date.now() - startTime,
        })
      } catch (_generateError) {
        clearTimeout(timeoutId)
        return success(this.getFallbackAdvice(context, startTime))
      }
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Unknown advisor error'))
    }
  }

  private buildUserPrompt(context: ImportAdvisorContext, language: 'ja' | 'en'): string {
    if (language === 'ja') {
      return `以下のインポートデータに関する専門的なアドバイスを提供してください：

インポート種別: ${context.importType}
データ件数: ${context.totalRows}件
エラー件数: ${context.errorCount}件
警告件数: ${context.warningCount}件

インポート成功のために確認すべき重要な検証項目とチェック事項は何ですか？`
    }

    return `Please provide professional advice for the following import data:

Import Type: ${context.importType}
Total Rows: ${context.totalRows}
Errors: ${context.errorCount}
Warnings: ${context.warningCount}

What are the key verification checks and items to verify for a successful import?`
  }

  private parseAIResponse(content: string, _language: 'ja' | 'en'): AIResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AIResponse
        if (parsed.summary && Array.isArray(parsed.advice)) {
          return parsed
        }
      }
    } catch {
      // Fall through to default
    }

    return {
      summary: 'Advice generated based on import data analysis.',
      advice: [],
    }
  }

  private getFallbackAdvice(
    context: ImportAdvisorContext,
    startTime: number
  ): ImportAdvisorResponse {
    const advice: ImportAdviceItem[] = []

    if (context.errorCount > 0) {
      advice.push({
        id: 'fallback-errors',
        type: 'warning',
        title: 'Review Data Errors',
        titleJa: 'データエラーを確認してください',
        description: `${context.errorCount} errors were found in the import data. Please review and correct them before proceeding.`,
        descriptionJa: `${context.errorCount}件のエラーがインポートデータで見つかりました。続行する前に確認して修正してください。`,
        action: 'Check each error message and correct the source data',
        actionJa: '各エラーメッセージを確認し、ソースデータを修正してください',
        priority: 'high',
      })
    }

    if (context.warningCount > 0) {
      advice.push({
        id: 'fallback-warnings',
        type: 'suggestion',
        title: 'Review Warnings',
        titleJa: '警告を確認してください',
        description: `${context.warningCount} warnings were detected. Review them to ensure data quality.`,
        descriptionJa: `${context.warningCount}件の警告が検出されました。データ品質を確保するために確認してください。`,
        priority: 'medium',
      })
    }

    advice.push({
      id: 'fallback-backup',
      type: 'best_practice',
      title: 'Backup Before Import',
      titleJa: 'インポート前にバックアップ',
      description: 'Always backup your data before performing a large data import.',
      descriptionJa: '大量のデータインポートを行う前に、必ずデータをバックアップしてください。',
      priority: 'low',
    })

    return {
      success: true,
      advice,
      summary: 'Please review the import data carefully before proceeding.',
      summaryJa: '続行する前にインポートデータを慎重に確認してください。',
      persona: 'cpa',
      confidence: this.calculateConfidence(context),
      processingTimeMs: Date.now() - startTime,
    }
  }

  private calculateConfidence(context: ImportAdvisorContext): number {
    let confidence = 70

    if (context.totalRows > 0 && context.errorCount === 0) {
      confidence += 10
    }

    if (context.issues && context.issues.length > 0) {
      confidence += 10
    }

    if (context.totalRows > 100) {
      confidence += 5
    }

    return Math.min(100, confidence)
  }
}

export const importAdvisor = new ImportAdvisor()
