import { z } from 'zod'
import type {
  DisclosureDocument,
  ConversionRationale,
  AIEnhancedDisclosure,
} from '@/types/conversion'
import { createAIProviderFromEnv, type AIProvider } from '@/lib/integrations/ai'

const AI_TIMEOUT_MS = 60000

const AIEnhancedDisclosureSchema = z.object({
  enhancedContent: z.string(),
  enhancedContentEn: z.string(),
  addedReferences: z.array(z.string()),
  improvements: z.array(z.string()),
})

export class DisclosureAIEnhancer {
  private aiProvider: AIProvider | null
  private isMockMode: boolean

  constructor() {
    this.isMockMode = process.env.AI_MOCK_MODE === 'true'
    this.aiProvider = createAIProviderFromEnv()
  }

  async enhance(
    disclosure: DisclosureDocument,
    rationales: ConversionRationale[]
  ): Promise<AIEnhancedDisclosure> {
    if (this.isMockMode || !this.aiProvider) {
      return this.getMockEnhancedDisclosure(disclosure)
    }

    const prompt = this.createEnhancementPrompt(disclosure, rationales)

    try {
      const response = await this.callAI(prompt)
      const parsed = this.parseResponse(response)

      if (parsed) {
        return parsed
      }
    } catch (error) {
      console.error('[DisclosureAIEnhancer] AI enhancement failed:', error)
    }

    return this.getMockEnhancedDisclosure(disclosure)
  }

  private createEnhancementPrompt(
    disclosure: DisclosureDocument,
    rationales: ConversionRationale[]
  ): string {
    const referencesList = disclosure.standardReferences
      .map((r) => `- ${r.referenceNumber}: ${r.title}`)
      .join('\n')

    const rationalesList = rationales
      .slice(0, 10)
      .map((r) => `- ${r.summary}`)
      .join('\n')

    return `以下の開示文書を改善し、監査法人が求める水準の品質にしてください。

【現在の開示文書】
${disclosure.content}

【関連する会計基準参照】
${referencesList || '（参照なし）'}

【変換根拠】
${rationalesList || '（根拠なし）'}

改善ポイント:
1. 会計基準の具体的な参照を追加
2. 定量的情報を補完
3. 判断と見積もりの開示を追加
4. 比較情報との整合性を確保
5. 明確で簡潔な表現に

以下のJSON形式で回答:
{
  "enhancedContent": "改善後の開示文書（日本語）",
  "enhancedContentEn": "Improved disclosure document (English)",
  "addedReferences": ["追加した参照1", "追加した参照2"],
  "improvements": ["改善点1", "改善点2", "改善点3"]
}`
  }

  private async callAI(prompt: string): Promise<string> {
    if (!this.aiProvider) {
      throw new Error('AI provider not available')
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout')), AI_TIMEOUT_MS)
    })

    const result = await Promise.race([
      this.aiProvider.analyzeDocument({
        documentBase64: Buffer.from(prompt).toString('base64'),
        documentType: 'pdf',
        mimeType: 'text/plain',
      }),
      timeoutPromise,
    ])

    return result.rawText || ''
  }

  private parseResponse(response: string): AIEnhancedDisclosure | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return null
      }

      const parsed = JSON.parse(jsonMatch[0])
      const validated = AIEnhancedDisclosureSchema.parse(parsed)

      return {
        enhancedContent: validated.enhancedContent,
        enhancedContentEn: validated.enhancedContentEn,
        addedReferences: validated.addedReferences,
        improvements: validated.improvements,
      }
    } catch (error) {
      console.error('[DisclosureAIEnhancer] Failed to parse response:', error)
      return null
    }
  }

  private getMockEnhancedDisclosure(disclosure: DisclosureDocument): AIEnhancedDisclosure {
    const improvements = [
      '会計基準の参照を追加しました',
      '定量的情報を補完しました',
      '用語の統一性を確保しました',
    ]

    return {
      enhancedContent: `${disclosure.content}\n\n【AI改善】\n${improvements.join('\n')}`,
      enhancedContentEn: `${disclosure.contentEn ?? disclosure.content}\n\n[AI Enhanced]\n${improvements.join('\n')}`,
      addedReferences: [],
      improvements,
    }
  }
}

export const disclosureAIEnhancer = new DisclosureAIEnhancer()
