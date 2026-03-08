import {
  BaseAIProvider,
  AIConfig,
  AIProviderType,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'

export class MockAIProvider extends BaseAIProvider {
  readonly name: AIProviderType = 'openai'

  constructor(config: AIConfig) {
    super(config)
  }

  async analyzeDocument(_request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    await this.simulateDelay(200, 500)

    const mockVendors = [
      '株式会社医薬開発研究所',
      'バイオシグマ株式会社',
      'クロニクル・ファーマ株式会社',
      'ABCバイオサイエンス株式会社',
      '日本CRO協会',
      '株式会社メディデータ・ソリューションズ',
      '東京臨床試験センター',
      '株式会社バイオ・アナリシス',
    ]

    const mockDescriptions = [
      '非臨床毒性試験委託費',
      '薬物動態試験費用（ラット）',
      '原薬製造委託費（CDMO）',
      '製剤開発委託費',
      '特許出願費用（米国）',
      '実験用試薬購入費',
      '分析機器保守点検費',
      '臨床試験準備費',
    ]

    const randomAmount = Math.floor(Math.random() * 1000000) + 10000
    const taxRate = Math.random() > 0.3 ? 0.1 : 0
    const taxAmount = Math.floor(randomAmount * taxRate)

    return {
      date: this.generateRandomDate(),
      amount: randomAmount,
      taxAmount,
      taxRate,
      description: mockDescriptions[Math.floor(Math.random() * mockDescriptions.length)],
      vendorName: mockVendors[Math.floor(Math.random() * mockVendors.length)],
      confidence: 0.75 + Math.random() * 0.25,
      rawText: '[MOCK] This is a mock document analysis result for development purposes.',
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    await this.simulateDelay(100, 300)

    const { journalEntry, documentData } = request
    const issues: ValidationIssue[] = []
    const suggestions: string[] = []

    const randomValue = Math.random()

    if (randomValue < 0.7) {
      return {
        isValid: true,
        issues: [],
        suggestions: ['Mock: Entry appears valid based on document analysis.'],
      }
    }

    if (randomValue < 0.85) {
      issues.push({
        field: 'amount',
        severity: 'warning',
        message: '金額に小さな差異があります',
        messageEn: 'Small amount discrepancy detected',
        expectedValue: journalEntry.amount,
        actualValue: documentData.amount,
      })
      suggestions.push('Mock: Consider verifying the amount with the source document.')
    } else if (randomValue < 0.95) {
      issues.push({
        field: 'date',
        severity: 'warning',
        message: '日付が異なる可能性があります',
        messageEn: 'Date mismatch detected',
        expectedValue: journalEntry.date,
        actualValue: documentData.date,
      })
      suggestions.push('Mock: Please verify the transaction date.')
    } else {
      issues.push({
        field: 'taxAmount',
        severity: 'error',
        message: '消費税額が一致しません',
        messageEn: 'Tax amount mismatch',
        expectedValue: journalEntry.taxAmount,
        actualValue: documentData.taxAmount,
      })
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      suggestions,
    }
  }

  private generateRandomDate(): string {
    const now = new Date()
    const daysAgo = Math.floor(Math.random() * 90)
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    return date.toISOString().split('T')[0]
  }

  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

export function createMockAIProvider(config: AIConfig): MockAIProvider {
  return new MockAIProvider(config)
}
