import { prisma } from '@/lib/db'
import OpenAI from 'openai'
import { getModelConfigService } from '@/lib/ai/config/model-config'
import { apiKeyService } from '@/services/secrets/api-key-service'
import { MemoryCache } from '@/lib/cache'
import crypto from 'crypto'
import type {
  Result,
  JournalProposalInput,
  JournalProposalOutput,
  JournalEntryProposal,
  StoreMetadata,
  ProposalFilters,
  ProposalStatus,
  AIProposalResponse,
  ChartOfAccountItem,
  AIGenerationOptions,
} from './types'
import { JOURNAL_PROPOSAL_PROMPT as PROMPT } from './prompts/journal-proposal'

const TIMEOUT_MS = 30000
const CHART_OF_ACCOUNTS_CACHE_TTL_MS = 30 * 60 * 1000

const chartOfAccountsCache = new MemoryCache<ChartOfAccountItem[]>(CHART_OF_ACCOUNTS_CACHE_TTL_MS)

type PrismaWithJournalProposal = typeof prisma & {
  journalProposal: {
    findUnique: (args: { where: { id?: string; documentId?: string } }) => Promise<{
      id: string
      companyId: string
      documentId: string
      userContext: string
      proposals: string
      aiProvider: string
      aiModel: string
      status: string
      createdBy: string
      createdAt: Date
      reviewedBy: string | null
      reviewedAt: Date | null
    } | null>
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
    findMany: (args: {
      where: Record<string, unknown>
      orderBy: { createdAt: 'desc' }
      take: number
      skip: number
    }) => Promise<
      Array<{
        id: string
        documentId: string
        proposals: string
        status: string
        createdAt: Date
      }>
    >
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
  }
}

const db = prisma as PrismaWithJournalProposal

export class JournalProposalService {
  constructor() {}

  async propose(
    input: JournalProposalInput,
    options?: AIGenerationOptions
  ): Promise<Result<JournalProposalOutput>> {
    try {
      const validationError = this.validateInput(input)
      if (validationError) {
        return { success: false, error: new Error(validationError) }
      }

      if (!input.ocrResult.success) {
        return {
          success: false,
          error: new Error(`OCR failed: ${input.ocrResult.error.message}`),
        }
      }

      const coaCacheKey = `coa:${input.companyId}`
      let chartOfAccounts = chartOfAccountsCache.get(coaCacheKey)
      if (!chartOfAccounts) {
        chartOfAccounts = input.chartOfAccounts || (await this.getChartOfAccounts(input.companyId))
        if (chartOfAccounts.length > 0) {
          chartOfAccountsCache.set(coaCacheKey, chartOfAccounts)
        }
      }

      if (chartOfAccounts.length === 0) {
        return {
          success: false,
          error: new Error('No chart of accounts available for this company'),
        }
      }

      const aiConfig = await this.getAIConfig(input.companyId)
      if (!aiConfig) {
        return {
          success: false,
          error: new Error('AI provider not available'),
        }
      }

      const userPrompt = this.buildUserPrompt(input, chartOfAccounts)

      const aiResponse = await this.callAIWithTimeout(
        aiConfig.client,
        aiConfig.model,
        PROMPT.system,
        userPrompt,
        {
          seed: options?.enableReproducibility ? this.generateSeed(input) : options?.seed,
          temperature: options?.temperature,
        }
      )

      const parsedResponse = this.parseAIResponse(aiResponse)

      const output = this.validateAndBuildOutput(
        parsedResponse,
        chartOfAccounts,
        aiConfig.provider,
        aiConfig.model
      )

      if (output.warnings.length > 0) {
        console.warn('[JournalProposal] Warnings:', output.warnings)
      }

      return { success: true, data: output }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: new Error(`Journal proposal failed: ${message}`) }
    }
  }

  async storeProposal(
    proposal: JournalProposalOutput,
    metadata: StoreMetadata
  ): Promise<Result<{ id: string }>> {
    try {
      const validationError = this.validateProposal(proposal)
      if (validationError) {
        return { success: false, error: new Error(validationError) }
      }

      const existing = await db.journalProposal.findUnique({
        where: { documentId: metadata.receiptId },
      })

      if (existing) {
        return {
          success: false,
          error: new Error('Proposal already exists for this document'),
        }
      }

      const stored = await db.journalProposal.create({
        data: {
          companyId: metadata.companyId,
          documentId: metadata.receiptId,
          userContext: metadata.userContext || '',
          proposals: JSON.stringify(proposal),
          aiProvider: proposal.aiProvider,
          aiModel: proposal.aiModel,
          status: 'pending',
          createdBy: metadata.userId,
        },
      })

      return { success: true, data: { id: stored.id } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: new Error(`Failed to store proposal: ${message}`) }
    }
  }

  async getProposals(
    companyId: string,
    filters?: ProposalFilters
  ): Promise<
    Result<
      Array<{
        id: string
        documentId: string
        proposals: JournalProposalOutput
        status: ProposalStatus
        createdAt: Date
      }>
    >
  > {
    try {
      const where: Record<string, unknown> = { companyId }

      if (filters?.status) {
        where.status = filters.status
      }

      if (filters?.fromDate || filters?.toDate) {
        const createdAtFilter: Record<string, Date> = {}
        if (filters.fromDate) {
          createdAtFilter.gte = filters.fromDate
        }
        if (filters.toDate) {
          createdAtFilter.lte = filters.toDate
        }
        where.createdAt = createdAtFilter
      }

      const proposals = await db.journalProposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      })

      const result = proposals.map((p) => ({
        id: p.id,
        documentId: p.documentId,
        proposals: JSON.parse(p.proposals) as JournalProposalOutput,
        status: p.status as ProposalStatus,
        createdAt: p.createdAt,
      }))

      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: new Error(`Failed to get proposals: ${message}`) }
    }
  }

  async updateStatus(
    proposalId: string,
    status: ProposalStatus,
    userId: string
  ): Promise<Result<void>> {
    try {
      const proposal = await db.journalProposal.findUnique({
        where: { id: proposalId },
      })

      if (!proposal) {
        return { success: false, error: new Error('Proposal not found') }
      }

      await db.journalProposal.update({
        where: { id: proposalId },
        data: {
          status,
          reviewedBy: userId,
          reviewedAt: new Date(),
        },
      })

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: new Error(`Failed to update status: ${message}`) }
    }
  }

  private validateInput(input: JournalProposalInput): string | null {
    if (!input.receiptId || typeof input.receiptId !== 'string') {
      return 'Invalid receiptId'
    }
    if (!input.companyId || typeof input.companyId !== 'string') {
      return 'Invalid companyId'
    }
    if (!input.userId || typeof input.userId !== 'string') {
      return 'Invalid userId'
    }
    if (!input.ocrResult) {
      return 'ocrResult is required'
    }
    return null
  }

  private validateProposal(proposal: JournalProposalOutput): string | null {
    if (!proposal.entries || proposal.entries.length === 0) {
      return 'At least one journal entry is required'
    }

    for (const entry of proposal.entries) {
      const entryError = this.validateEntry(entry)
      if (entryError) {
        return entryError
      }
    }

    if (proposal.confidence < 0 || proposal.confidence > 1) {
      return 'Confidence must be between 0 and 1'
    }

    return null
  }

  private validateEntry(entry: JournalEntryProposal): string | null {
    if (!(entry.entryDate instanceof Date) || isNaN(entry.entryDate.getTime())) {
      return 'Invalid entryDate'
    }
    if (!entry.debitAccount || typeof entry.debitAccount !== 'string') {
      return 'Invalid debitAccount'
    }
    if (!entry.creditAccount || typeof entry.creditAccount !== 'string') {
      return 'Invalid creditAccount'
    }
    if (typeof entry.amount !== 'number' || entry.amount <= 0) {
      return 'Amount must be a positive number'
    }
    if (typeof entry.taxAmount !== 'number' || entry.taxAmount < 0) {
      return 'TaxAmount must be a non-negative number'
    }
    return null
  }

  private async getChartOfAccounts(companyId: string): Promise<ChartOfAccountItem[]> {
    try {
      const coa = await prisma.chartOfAccount.findFirst({
        where: { companyId, isActive: true, isDefault: true },
        include: {
          items: {
            orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
          },
        },
      })

      if (!coa) {
        return []
      }

      return coa.items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category,
        subcategory: item.subcategory || undefined,
        normalBalance: item.normalBalance as 'debit' | 'credit',
      }))
    } catch (error) {
      console.error('[JournalProposal] Failed to get chart of accounts:', error)
      return []
    }
  }

  private async getAIConfig(
    companyId: string
  ): Promise<{ client: OpenAI; provider: string; model: string } | null> {
    try {
      const keyConfig = await apiKeyService.getAPIKey('openai', { companyId })
      if (!keyConfig) {
        console.warn('[JournalProposal] No API key found for openai')
        return null
      }

      const modelConfigService = getModelConfigService()
      const resolvedConfig = await modelConfigService.getConfig('openai', { companyId })

      const client = new OpenAI({
        apiKey: keyConfig.key,
        timeout: TIMEOUT_MS,
      })

      return {
        client,
        provider: 'openai',
        model: resolvedConfig.model,
      }
    } catch (error) {
      console.error('[JournalProposal] Failed to create AI config:', error)
      return null
    }
  }

  private buildUserPrompt(
    input: JournalProposalInput,
    chartOfAccounts: ChartOfAccountItem[]
  ): string {
    const ocrData = input.ocrResult.success ? input.ocrResult.data : null

    const ocrDate = ocrData?.date || '不明'
    const ocrAmount = ocrData?.totalAmount?.toLocaleString() || '不明'
    const ocrTaxAmount = ocrData?.taxAmount?.toLocaleString() || '不明'
    const ocrTaxRate = ocrData?.taxRate?.toString() || '不明'
    const ocrVendor = ocrData?.vendor || '不明'

    let ocrItems = '（明細なし）'
    if (ocrData?.items && ocrData.items.length > 0) {
      ocrItems = ocrData.items
        .map(
          (item, i) =>
            `  ${i + 1}. ${item.name}${item.quantity ? ` x${item.quantity}` : ''}${item.amount ? `: ${item.amount.toLocaleString()}円` : ''}`
        )
        .join('\n')
    }

    const chartOfAccountsStr = chartOfAccounts
      .slice(0, 50)
      .map((a) => `- ${a.code}: ${a.name} (${a.category})`)
      .join('\n')

    const prompt = PROMPT.user
      .replace('{{ocrDate}}', ocrDate)
      .replace('{{ocrAmount}}', ocrAmount)
      .replace('{{ocrTaxAmount}}', ocrTaxAmount)
      .replace('{{ocrTaxRate}}', ocrTaxRate)
      .replace('{{ocrVendor}}', ocrVendor)
      .replace('{{ocrItems}}', ocrItems)
      .replace('{{additionalContext}}', input.additionalContext || 'なし')
      .replace('{{chartOfAccounts}}', chartOfAccountsStr)

    return prompt
  }

  private async callAIWithTimeout(
    client: OpenAI,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options?: { seed?: number; temperature?: number }
  ): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout')), TIMEOUT_MS)
    })

    const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: options?.temperature ?? 0.1,
    }

    if (options?.seed !== undefined) {
      requestOptions.seed = options.seed
    }

    const aiPromise = client.chat.completions.create(requestOptions)

    const response = await Promise.race([aiPromise, timeoutPromise])

    return response.choices[0]?.message?.content || '{}'
  }

  private generateSeed(input: JournalProposalInput): number {
    const rawText = input.ocrResult.success ? input.ocrResult.data?.rawText || '' : ''
    const hash = crypto.createHash('sha256').update(`${input.receiptId}:${rawText}`).digest()
    return hash.readInt32BE(0)
  }

  private parseAIResponse(responseText: string): AIProposalResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      if (!parsed.entries || !Array.isArray(parsed.entries)) {
        throw new Error('Invalid response format: missing entries array')
      }

      return {
        entries: parsed.entries.map((e: Record<string, unknown>) => ({
          entryDate: String(e.entryDate || ''),
          description: String(e.description || ''),
          debitAccount: String(e.debitAccount || ''),
          debitAccountName: String(e.debitAccountName || ''),
          creditAccount: String(e.creditAccount || ''),
          creditAccountName: String(e.creditAccountName || ''),
          amount: Number(e.amount) || 0,
          taxAmount: Number(e.taxAmount) || 0,
          taxType: e.taxType ? String(e.taxType) : undefined,
        })),
        rationale: String(parsed.rationale || ''),
        confidence: Number(parsed.confidence) || 0.5,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      }
    } catch (error) {
      console.error('[JournalProposal] Failed to parse AI response:', error)
      return {
        entries: [],
        rationale: 'AIレスポンスのパースに失敗しました',
        confidence: 0,
        warnings: ['Failed to parse AI response'],
      }
    }
  }

  private validateAndBuildOutput(
    parsedResponse: AIProposalResponse,
    chartOfAccounts: ChartOfAccountItem[],
    aiProvider: string,
    aiModel: string
  ): JournalProposalOutput {
    const warnings: string[] = [...parsedResponse.warnings]
    const accountMap = new Map(chartOfAccounts.map((a) => [a.code, a]))

    const validEntries: JournalEntryProposal[] = []

    for (const entry of parsedResponse.entries) {
      const validationErrors: string[] = []

      const debitAccount = accountMap.get(entry.debitAccount)
      const creditAccount = accountMap.get(entry.creditAccount)

      if (!debitAccount) {
        validationErrors.push(`借方勘定科目 "${entry.debitAccount}" が見つかりません`)
      }
      if (!creditAccount) {
        validationErrors.push(`貸方勘定科目 "${entry.creditAccount}" が見つかりません`)
      }

      let entryDate: Date
      try {
        entryDate = new Date(entry.entryDate)
        if (isNaN(entryDate.getTime())) {
          throw new Error('Invalid date')
        }
      } catch {
        entryDate = new Date()
        validationErrors.push('日付が無効なため本日の日付を使用しました')
      }

      if (entry.amount <= 0) {
        validationErrors.push('金額が正の数ではありません')
        continue
      }

      if (entry.taxAmount < 0) {
        validationErrors.push('消費税額が負の値です')
        entry.taxAmount = 0
      }

      if (validationErrors.length > 0) {
        warnings.push(...validationErrors)
      }

      if (debitAccount && creditAccount && entry.amount > 0) {
        validEntries.push({
          entryDate,
          description: entry.description,
          debitAccount: entry.debitAccount,
          debitAccountName: debitAccount.name,
          creditAccount: entry.creditAccount,
          creditAccountName: creditAccount.name,
          amount: entry.amount,
          taxAmount: entry.taxAmount,
          taxType: entry.taxType,
        })
      }
    }

    if (validEntries.length === 0) {
      warnings.push('有効な仕訳が生成されませんでした')
    }

    return {
      entries: validEntries,
      rationale: parsedResponse.rationale,
      confidence: parsedResponse.confidence,
      warnings,
      aiProvider,
      aiModel,
    }
  }
}

export const journalProposalService = new JournalProposalService()
