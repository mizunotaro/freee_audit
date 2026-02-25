import { AIProviderInterface, createAIProviderFromEnv } from '@/lib/integrations/ai'
import { DocumentAnalysisResult } from '@/types/audit'
import fs from 'fs/promises'
import path from 'path'

export interface ReceiptAnalyzerConfig {
  aiProvider?: AIProviderInterface
  preferGeminiForPdf?: boolean
}

export class ReceiptAnalyzer {
  private aiProvider: AIProviderInterface | null
  private preferGeminiForPdf: boolean

  constructor(config?: ReceiptAnalyzerConfig) {
    this.aiProvider = config?.aiProvider ?? null
    this.preferGeminiForPdf = config?.preferGeminiForPdf ?? true
  }

  async analyzeFile(filePath: string): Promise<DocumentAnalysisResult> {
    const fileBuffer = await fs.readFile(filePath)
    const extension = path.extname(filePath).toLowerCase()
    const documentType = this.getDocumentType(extension)
    const mimeType = this.getMimeType(extension)

    return this.analyzeBuffer(fileBuffer, documentType, mimeType)
  }

  async analyzeBuffer(
    buffer: Buffer,
    documentType: 'pdf' | 'image' | 'excel',
    mimeType: string
  ): Promise<DocumentAnalysisResult> {
    if (!this.aiProvider) {
      throw new Error('AI provider is not configured')
    }

    const documentBase64 = buffer.toString('base64')

    const provider = this.getPreferredProvider(documentType)

    const result = await provider.analyzeDocument({
      documentBase64,
      mimeType,
    })

    return result
  }

  private getPreferredProvider(documentType: 'pdf' | 'image' | 'excel'): AIProviderInterface {
    if (documentType === 'pdf' && this.preferGeminiForPdf) {
      return createAIProviderFromEnv({ provider: 'gemini' })
    }

    if (!this.aiProvider) {
      throw new Error('No AI provider available')
    }

    return this.aiProvider
  }

  private getDocumentType(extension: string): 'pdf' | 'image' | 'excel' {
    switch (extension) {
      case '.pdf':
        return 'pdf'
      case '.xlsx':
      case '.xls':
        return 'excel'
      default:
        return 'image'
    }
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
    }

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
  }
}

export function createReceiptAnalyzer(config?: ReceiptAnalyzerConfig): ReceiptAnalyzer {
  return new ReceiptAnalyzer(config)
}
