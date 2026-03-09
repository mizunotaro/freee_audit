import { prisma } from '@/lib/db'
import { JournalConverter, getOptimalBatchSize } from './journal-converter'
import { FinancialStatementConverter } from './financial-statement-converter'
import { AccountMappingService } from './account-mapping-service'
import type {
  ConversionResult,
  ConversionSettings,
  ConversionStatus,
  ConversionError,
  ConversionWarning,
  AccountMapping,
  JournalConversion,
  ConvertedBalanceSheet,
  ConvertedProfitLoss,
  ConvertedCashFlow,
} from '@/types/conversion'

export interface ExecutionOptions {
  dryRun?: boolean
  skipValidation?: boolean
  batchSize?: number
}

export interface ConversionProgress {
  status: ConversionStatus
  progress: number
  currentItem?: string
  processedJournals: number
  totalJournals: number
  errors: ConversionError[]
  startedAt: Date
  estimatedCompletion?: Date
}

export interface DryRunResult {
  wouldCreate: {
    journalConversions: number
    adjustingEntries: number
    disclosures: number
  }
  warnings: ConversionWarning[]
  estimatedDurationMs: number
}

interface AbortControllerEntry {
  controller: AbortController
  startTime: Date
}

const CONVERSION_TIMEOUT_MS = 30 * 60 * 1000

export class ConversionEngine {
  private journalConverter: JournalConverter
  private fsConverter: FinancialStatementConverter
  private mappingService: AccountMappingService
  private abortControllers: Map<string, AbortControllerEntry>

  constructor() {
    this.journalConverter = new JournalConverter()
    this.fsConverter = new FinancialStatementConverter()
    this.mappingService = new AccountMappingService()
    this.abortControllers = new Map()
  }

  async execute(projectId: string, options?: ExecutionOptions): Promise<ConversionResult> {
    const startTime = Date.now()
    const project = await this.getProject(projectId)

    if (options?.dryRun) {
      const dryRunResult = await this.dryRun(projectId)
      return this.createDryRunResult(projectId, dryRunResult, startTime)
    }

    const abortController = new AbortController()
    this.abortControllers.set(projectId, {
      controller: abortController,
      startTime: new Date(),
    })

    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, CONVERSION_TIMEOUT_MS)

    try {
      await this.updateProjectStatus(projectId, 'converting', 0)

      const mappings = await this.loadMappings(project.companyId, project.targetCoaId)

      if (!options?.skipValidation) {
        const validationResult = await this.validateMappings(mappings)
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      const totalJournals = await this.countJournals(
        project.companyId,
        project.periodStart,
        project.periodEnd
      )

      const batchSize = options?.batchSize ?? getOptimalBatchSize(totalJournals)

      const journalConversions = await this.convertJournals(
        project,
        mappings,
        batchSize,
        totalJournals,
        abortController.signal
      )

      if (abortController.signal.aborted) {
        throw new Error('Conversion aborted')
      }

      let balanceSheet: ConvertedBalanceSheet | undefined
      let profitLoss: ConvertedProfitLoss | undefined
      let cashFlow: ConvertedCashFlow | undefined

      if (project.settings.includeFinancialStatements) {
        const fiscalYear = project.periodStart.getFullYear()
        const month = project.periodEnd.getMonth() + 1

        const [bs, pl, cf] = await Promise.all([
          this.fsConverter.convertBalanceSheet(
            project.companyId,
            fiscalYear,
            month,
            journalConversions,
            project.targetCoaId
          ),
          this.fsConverter.convertProfitLoss(
            project.companyId,
            fiscalYear,
            month,
            journalConversions
          ),
          this.fsConverter.convertCashFlow(project.companyId, fiscalYear, journalConversions),
        ])

        balanceSheet = bs
        profitLoss = pl
        cashFlow = cf
      }

      await this.updateProjectStatus(projectId, 'completed', 100, new Date())

      const conversionDurationMs = Date.now() - startTime

      const result = await this.saveResult({
        projectId,
        journalConversions,
        balanceSheet,
        profitLoss,
        cashFlow,
        conversionDurationMs,
        warnings: [],
        errors: [],
      })

      return result
    } catch (error) {
      await this.updateProjectStatus(projectId, 'error', 0)
      throw error
    } finally {
      clearTimeout(timeoutId)
      this.abortControllers.delete(projectId)
    }
  }

  async dryRun(projectId: string): Promise<DryRunResult> {
    const project = await this.getProject(projectId)

    const mappings = await this.loadMappings(project.companyId, project.targetCoaId)

    const totalJournals = await this.countJournals(
      project.companyId,
      project.periodStart,
      project.periodEnd
    )

    const unmappedAccounts = await this.journalConverter.findUnmappedAccounts(
      project.companyId,
      mappings
    )

    const warnings: ConversionWarning[] = []

    if (unmappedAccounts.length > 0) {
      warnings.push({
        code: 'UNMAPPED_ACCOUNTS',
        message: `${unmappedAccounts.length} accounts have no mappings`,
        details: {
          accounts: unmappedAccounts.slice(0, 10).map((a) => a.accountCode),
        },
      })
    }

    const lowConfidenceMappings = Array.from(mappings.values()).filter((m) => m.confidence < 0.7)
    if (lowConfidenceMappings.length > 0) {
      warnings.push({
        code: 'LOW_CONFIDENCE_MAPPINGS',
        message: `${lowConfidenceMappings.length} mappings have low confidence (< 70%)`,
        details: {
          count: lowConfidenceMappings.length,
        },
      })
    }

    const manualReviewMappings = Array.from(mappings.values()).filter((m) => m.isManualReview)
    if (manualReviewMappings.length > 0) {
      warnings.push({
        code: 'MANUAL_REVIEW_REQUIRED',
        message: `${manualReviewMappings.length} mappings require manual review`,
        details: {
          count: manualReviewMappings.length,
        },
      })
    }

    const estimatedDurationMs = Math.round(totalJournals * 5)

    return {
      wouldCreate: {
        journalConversions: totalJournals,
        adjustingEntries: project.settings.generateAdjustingEntries ? 10 : 0,
        disclosures: 5,
      },
      warnings,
      estimatedDurationMs,
    }
  }

  async getProgress(projectId: string): Promise<ConversionProgress> {
    const project = await this.getProject(projectId)

    const totalJournals = await this.countJournals(
      project.companyId,
      project.periodStart,
      project.periodEnd
    )

    const processedJournals = Math.round((project.progress / 100) * totalJournals)

    const abortEntry = this.abortControllers.get(projectId)
    const startedAt = abortEntry?.startTime ?? project.createdAt

    let estimatedCompletion: Date | undefined
    if (project.progress > 0 && project.progress < 100) {
      const elapsedMs = Date.now() - startedAt.getTime()
      const estimatedTotalMs = (elapsedMs / project.progress) * 100
      estimatedCompletion = new Date(startedAt.getTime() + estimatedTotalMs)
    }

    const errors = await this.getConversionErrors(projectId)

    return {
      status: project.status,
      progress: project.progress,
      processedJournals,
      totalJournals,
      errors,
      startedAt,
      estimatedCompletion,
    }
  }

  async abort(projectId: string): Promise<void> {
    const abortEntry = this.abortControllers.get(projectId)
    if (abortEntry) {
      abortEntry.controller.abort()
    }

    await this.updateProjectStatus(projectId, 'error', 0)
  }

  async resume(projectId: string): Promise<ConversionResult> {
    const project = await this.getProject(projectId)

    if (project.status !== 'error') {
      throw new Error(`Cannot resume project with status: ${project.status}`)
    }

    await this.updateProjectStatus(projectId, 'draft', 0)

    return this.execute(projectId)
  }

  private async getProject(projectId: string): Promise<{
    id: string
    companyId: string
    targetCoaId: string
    periodStart: Date
    periodEnd: Date
    status: ConversionStatus
    progress: number
    settings: ConversionSettings
    createdAt: Date
  }> {
    const project = await prisma.conversionProject.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    return {
      id: project.id,
      companyId: project.companyId,
      targetCoaId: project.targetCoaId,
      periodStart: project.periodStart,
      periodEnd: project.periodEnd,
      status: project.status as ConversionStatus,
      progress: project.progress,
      settings: JSON.parse(project.settings) as ConversionSettings,
      createdAt: project.createdAt,
    }
  }

  private async updateProjectStatus(
    projectId: string,
    status: ConversionStatus,
    progress: number,
    completedAt?: Date
  ): Promise<void> {
    await prisma.conversionProject.update({
      where: { id: projectId },
      data: {
        status,
        progress,
        completedAt,
      },
    })
  }

  private async loadMappings(
    companyId: string,
    targetCoaId: string
  ): Promise<Map<string, AccountMapping>> {
    const result = await this.mappingService.getByCompany(companyId, {
      targetCoaId,
      isApproved: true,
    })

    const mappings = new Map<string, AccountMapping>()
    for (const mapping of result.data) {
      mappings.set(mapping.sourceAccountCode, mapping)
    }

    return mappings
  }

  private async validateMappings(mappings: Map<string, AccountMapping>): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    if (mappings.size === 0) {
      errors.push('No approved mappings found')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  private async countJournals(
    companyId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    return prisma.journal.count({
      where: {
        companyId,
        entryDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })
  }

  private async convertJournals(
    project: {
      id: string
      companyId: string
      periodStart: Date
      periodEnd: Date
      settings: ConversionSettings
    },
    mappings: Map<string, AccountMapping>,
    batchSize: number,
    totalJournals: number,
    signal: AbortSignal
  ): Promise<JournalConversion[]> {
    const allConversions: JournalConversion[] = []
    let processedCount = 0

    for await (const journalBatch of this.journalConverter.streamJournals(
      project.companyId,
      project.periodStart,
      project.periodEnd
    )) {
      if (signal.aborted) {
        throw new Error('Conversion aborted')
      }

      for await (const batchResult of this.journalConverter.convertBatch(
        journalBatch,
        mappings,
        batchSize
      )) {
        allConversions.push(...batchResult.conversions)
        processedCount += batchResult.processedCount

        const progress = Math.round((processedCount / totalJournals) * 100)
        await this.updateProjectStatus(project.id, 'converting', progress)
      }
    }

    return allConversions
  }

  private async saveResult(data: {
    projectId: string
    journalConversions: JournalConversion[]
    balanceSheet?: ConvertedBalanceSheet
    profitLoss?: ConvertedProfitLoss
    cashFlow?: ConvertedCashFlow
    conversionDurationMs: number
    warnings: ConversionWarning[]
    errors: ConversionError[]
  }): Promise<ConversionResult> {
    const result = await prisma.conversionResult.create({
      data: {
        projectId: data.projectId,
        journalConversions: JSON.stringify(data.journalConversions),
        balanceSheet: data.balanceSheet ? JSON.stringify(data.balanceSheet) : null,
        profitLoss: data.profitLoss ? JSON.stringify(data.profitLoss) : null,
        cashFlow: data.cashFlow ? JSON.stringify(data.cashFlow) : null,
        conversionDate: new Date(),
        conversionDurationMs: data.conversionDurationMs,
        warnings: JSON.stringify(data.warnings),
        errors: JSON.stringify(data.errors),
      },
    })

    return {
      id: result.id,
      projectId: result.projectId,
      journalConversions: data.journalConversions,
      balanceSheet: data.balanceSheet,
      profitLoss: data.profitLoss,
      cashFlow: data.cashFlow,
      conversionDate: result.conversionDate,
      conversionDurationMs: result.conversionDurationMs,
      warnings: data.warnings,
      errors: data.errors,
    }
  }

  private async getConversionErrors(projectId: string): Promise<ConversionError[]> {
    const result = await prisma.conversionResult.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    if (!result || !result.errors) {
      return []
    }

    return JSON.parse(result.errors) as ConversionError[]
  }

  private createDryRunResult(
    projectId: string,
    dryRunResult: DryRunResult,
    startTime: number
  ): ConversionResult {
    return {
      id: `dryrun-${projectId}`,
      projectId,
      journalConversions: [],
      conversionDate: new Date(),
      conversionDurationMs: Date.now() - startTime,
      warnings: dryRunResult.warnings,
      errors: [],
    }
  }
}

export const conversionEngine = new ConversionEngine()
