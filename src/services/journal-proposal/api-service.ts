import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'
import {
  fetchWithTimeout,
  withRetry,
  createAppError,
  sanitizeForLog,
  type Result,
  type AppError,
} from '@/lib/journal-proposal'
import type { JournalProposalOutput } from '@/types/journal-proposal'

export interface AnalyzeDocumentOptions {
  file: File
  companyId: string
  userId: string
  userContext: string
  fiscalYear?: number
}

export interface AnalyzeDocumentResult {
  documentId: string
  ocrResult: JournalProposalOutput['ocrResult']
  proposals: JournalProposalOutput['proposals']
  generatedAt: Date
  aiProvider: string
  aiModel: string
}

export interface ProposalListOptions {
  status?: string
  page?: number
  pageSize?: number
  sortBy?: 'date' | 'amount' | 'confidence'
  sortDirection?: 'asc' | 'desc'
}

export interface ManualInputData {
  date: string
  vendor: string
  totalAmount: number
  taxAmount: number
  taxRate: number
  description: string
  items: Array<{ name: string; amount: number }>
}

export interface AnalyzeWithManualInputOptions {
  companyId: string
  manualData: ManualInputData
  userId?: string
  fiscalYear?: number
}

class JournalProposalApiService {
  private readonly endpoint: string
  private readonly timeout: number

  constructor() {
    this.endpoint = JOURNAL_PROPOSAL_CONFIG.api.analyzeEndpoint
    this.timeout = JOURNAL_PROPOSAL_CONFIG.api.timeout
  }

  async analyzeDocument(
    options: AnalyzeDocumentOptions
  ): Promise<Result<AnalyzeDocumentResult, AppError>> {
    const { file, companyId, userId, userContext, fiscalYear } = options

    if (!file) {
      return {
        success: false,
        error: createAppError('VALIDATION_ERROR', 'File is required'),
      }
    }

    if (!companyId || !userId) {
      return {
        success: false,
        error: createAppError('AUTHORIZATION_ERROR', 'Company ID and User ID are required'),
      }
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('companyId', companyId)
    formData.append('userId', userId)
    formData.append('userContext', userContext)
    if (fiscalYear) {
      formData.append('fiscalYear', fiscalYear.toString())
    }

    try {
      const response = await withRetry(async () => {
        const res = await fetchWithTimeout(this.endpoint, {
          method: 'POST',
          body: formData,
          timeout: this.timeout,
        })
        return res
      })

      if (!response.ok) {
        const errorData = await this.safeParseJson(response)
        return {
          success: false,
          error: createAppError(
            'SERVER_ERROR',
            this.extractMessage(errorData) || `Server error: ${response.status}`,
            { statusCode: response.status }
          ),
        }
      }

      const result = await this.safeParseJson(response)

      if (!result || result.success !== true) {
        return {
          success: false,
          error: createAppError(
            'PARSE_ERROR',
            this.extractMessage(result) || 'Failed to parse response',
            { rawResponse: result }
          ),
        }
      }

      const data = result.data as AnalyzeDocumentResult
      return {
        success: true,
        data: {
          documentId: data.documentId,
          ocrResult: data.ocrResult,
          proposals: data.proposals,
          generatedAt: new Date(data.generatedAt),
          aiProvider: data.aiProvider,
          aiModel: data.aiModel,
        },
      }
    } catch (error) {
      const sanitizedError = sanitizeForLog({
        error: error instanceof Error ? error.message : String(error),
        companyId,
        userId,
        fileName: file.name,
        fileSize: file.size,
      })
      console.error('[JournalProposalApi] analyzeDocument error:', sanitizedError)

      return {
        success: false,
        error: createAppError(
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Unknown error occurred',
          sanitizedError,
          error instanceof Error ? error : undefined
        ),
      }
    }
  }

  async approveProposal(documentId: string, proposalId: string): Promise<Result<void, AppError>> {
    if (!documentId || !proposalId) {
      return {
        success: false,
        error: createAppError('VALIDATION_ERROR', 'Document ID and Proposal ID are required'),
      }
    }

    try {
      const response = await fetchWithTimeout(`${this.endpoint}/${documentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
        timeout: this.timeout,
      })

      if (!response.ok) {
        return {
          success: false,
          error: createAppError('SERVER_ERROR', `Failed to approve proposal: ${response.status}`, {
            statusCode: response.status,
          }),
        }
      }

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Network error',
          undefined,
          error instanceof Error ? error : undefined
        ),
      }
    }
  }

  async rejectProposal(documentId: string, proposalId: string): Promise<Result<void, AppError>> {
    if (!documentId || !proposalId) {
      return {
        success: false,
        error: createAppError('VALIDATION_ERROR', 'Document ID and Proposal ID are required'),
      }
    }

    try {
      const response = await fetchWithTimeout(`${this.endpoint}/${documentId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
        timeout: this.timeout,
      })

      if (!response.ok) {
        return {
          success: false,
          error: createAppError('SERVER_ERROR', `Failed to reject proposal: ${response.status}`, {
            statusCode: response.status,
          }),
        }
      }

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Network error',
          undefined,
          error instanceof Error ? error : undefined
        ),
      }
    }
  }

  async analyzeWithManualInput(
    options: AnalyzeWithManualInputOptions
  ): Promise<Result<AnalyzeDocumentResult, AppError>> {
    const { companyId, manualData, userId, fiscalYear } = options

    if (!companyId) {
      return {
        success: false,
        error: createAppError('AUTHORIZATION_ERROR', 'Company ID is required'),
      }
    }

    if (!manualData.date || !manualData.vendor || manualData.totalAmount === undefined) {
      return {
        success: false,
        error: createAppError('VALIDATION_ERROR', 'Date, vendor, and total amount are required'),
      }
    }

    try {
      const response = await fetchWithTimeout(`${this.endpoint}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          userId,
          fiscalYear,
          manualData,
        }),
        timeout: this.timeout,
      })

      if (!response.ok) {
        const errorData = await this.safeParseJson(response)
        return {
          success: false,
          error: createAppError(
            'SERVER_ERROR',
            this.extractMessage(errorData) || `Server error: ${response.status}`,
            { statusCode: response.status }
          ),
        }
      }

      const result = await this.safeParseJson(response)

      if (!result || result.success !== true) {
        return {
          success: false,
          error: createAppError(
            'PARSE_ERROR',
            this.extractMessage(result) || 'Failed to parse response',
            { rawResponse: result }
          ),
        }
      }

      const data = result.data as AnalyzeDocumentResult
      return {
        success: true,
        data: {
          documentId: data.documentId,
          ocrResult: data.ocrResult,
          proposals: data.proposals,
          generatedAt: new Date(data.generatedAt),
          aiProvider: data.aiProvider,
          aiModel: data.aiModel,
        },
      }
    } catch (error) {
      const sanitizedError = sanitizeForLog({
        error: error instanceof Error ? error.message : String(error),
        companyId,
        manualData: {
          date: manualData.date,
          vendor: manualData.vendor,
          totalAmount: manualData.totalAmount,
        },
      })
      console.error('[JournalProposalApi] analyzeWithManualInput error:', sanitizedError)

      return {
        success: false,
        error: createAppError(
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Unknown error occurred',
          sanitizedError,
          error instanceof Error ? error : undefined
        ),
      }
    }
  }

  private async safeParseJson(response: Response): Promise<Record<string, unknown> | null> {
    try {
      const text = await response.text()
      if (!text) return null
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return null
    }
  }

  private extractMessage(data: Record<string, unknown> | null): string {
    if (!data) return 'Unknown error'
    if (typeof data.message === 'string') return data.message
    if (data.error && typeof data.error === 'object' && data.error !== null) {
      const errorObj = data.error as Record<string, unknown>
      if (typeof errorObj.message === 'string') return errorObj.message
    }
    return 'Unknown error'
  }
}

export const journalProposalApi = new JournalProposalApiService()
