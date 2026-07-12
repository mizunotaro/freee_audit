import { describe, it, expect } from 'vitest'
import type { AccountingStandard } from '@/types/accounting-standard'
import type {
  AccountCategory,
  AccountingStandardInfo,
  ChartOfAccountItem,
  ChartOfAccounts,
  MappingCondition,
  ConversionRule,
  AccountMapping,
  MappingType,
  ConversionStatus,
  ApprovalStage,
  ApprovalStatus,
  AuditAction,
  ConversionProgress,
  ConversionSettings,
  ConversionStatistics,
  ConversionProject,
  ConvertedJournalLine,
  JournalConversion,
  AdjustmentType,
  AdjustingEntryLine,
  AdjustingEntry,
  DisclosureCategory,
  DisclosureNote,
  DisclosureTable,
  DisclosureSection,
  DisclosureStandardReference,
  DisclosureDocument,
  AIEnhancedDisclosure,
  ConversionWarning,
  ConversionError,
  ConvertedBalanceSheet,
  ConvertedProfitLoss,
  ConvertedCashFlow,
  MappingSuggestionAlternative,
  MappingSuggestion,
  AdjustmentRecommendationImpact,
  AdjustmentRecommendation,
  RiskAssessment,
  AIConversionAnalysis,
  ConversionResult,
  ExportConfig,
  ExportResult,
  CreateConversionProjectRequest,
  ExecuteConversionRequest,
  MappingSuggestionRequest,
  ConversionListResponse,
  ReferenceType,
  StandardReference,
  EntityType,
  RationaleType,
  ConversionRationale,
  RationaleAuditEntry,
  CreateRationaleInput,
  UpdateRationaleInput,
  RationaleFilters,
  AuditReportSummary,
  UnreviewedItem,
  SignificantImpact,
  StandardReferenceUsage,
  AuditReport,
  GeneratedRationale,
} from '@/types/conversion'

const CREATED = new Date('2024-01-15T00:00:00.000Z')
const UPDATED = new Date('2024-02-20T00:00:00.000Z')
const COMPLETED = new Date('2024-03-31T00:00:00.000Z')
const PERIOD_START = new Date('2024-04-01T00:00:00.000Z')
const PERIOD_END = new Date('2025-03-31T00:00:00.000Z')
const GENERATED_AT = new Date('2024-04-10T00:00:00.000Z')

describe('src/types/conversion', () => {
  describe('module resolution', () => {
    it('should be importable as an ESM module', async () => {
      const mod = await import('@/types/conversion')
      expect(mod).toBeDefined()
      expect(typeof mod).toBe('object')
    })

    it('should expose no runtime exports (pure type-only module)', async () => {
      const mod = await import('@/types/conversion')
      expect(Object.keys(mod)).toEqual([])
    })
  })

  describe('re-exported AccountingStandard', () => {
    it('should be re-exported and equal to the canonical union', () => {
      const standards: AccountingStandard[] = ['JGAAP', 'USGAAP', 'IFRS']
      expect(standards).toHaveLength(3)
      expectTypeOf<AccountingStandard>().toEqualTypeOf<'JGAAP' | 'USGAAP' | 'IFRS'>()
    })
  })

  describe('AccountCategory union', () => {
    const categories: AccountCategory[] = [
      'current_asset',
      'fixed_asset',
      'deferred_asset',
      'current_liability',
      'fixed_liability',
      'deferred_liability',
      'equity',
      'revenue',
      'cogs',
      'sga_expense',
      'non_operating_income',
      'non_operating_expense',
      'extraordinary_income',
      'extraordinary_loss',
    ]

    it('should expose exactly the 14 categories', () => {
      expect(categories).toHaveLength(14)
      expect(new Set(categories).size).toBe(14)
    })

    it('should reject case variants at the type level', () => {
      expectTypeOf<'Current_Asset'>().not.toMatchTypeOf<AccountCategory>()
      expectTypeOf<'CURRENT_ASSET'>().not.toMatchTypeOf<AccountCategory>()
    })
  })

  describe('ConversionStatus union', () => {
    const statuses: ConversionStatus[] = [
      'draft',
      'mapping',
      'validating',
      'converting',
      'reviewing',
      'completed',
      'error',
    ]

    it('should expose exactly the 7 statuses', () => {
      expect(statuses).toHaveLength(7)
      expect(new Set(statuses).size).toBe(7)
    })
  })

  describe('ApprovalStage union', () => {
    const stages: ApprovalStage[] = [
      'mapping_review',
      'rationale_review',
      'adjustment_review',
      'fs_review',
      'final_approval',
    ]

    it('should expose exactly the 5 stages', () => {
      expect(stages).toHaveLength(5)
      expect(new Set(stages).size).toBe(5)
    })
  })

  describe('ApprovalStatus union', () => {
    const statuses: ApprovalStatus[] = ['pending', 'in_review', 'approved', 'rejected', 'escalated']

    it('should expose exactly the 5 statuses', () => {
      expect(statuses).toHaveLength(5)
      expect(new Set(statuses).size).toBe(5)
    })
  })

  describe('AuditAction union', () => {
    const actions: AuditAction[] = [
      'project_create',
      'project_update',
      'project_delete',
      'project_execute',
      'project_abort',
      'mapping_create',
      'mapping_update',
      'mapping_delete',
      'mapping_approve',
      'mapping_batch_approve',
      'rationale_create',
      'rationale_update',
      'rationale_review',
      'adjustment_create',
      'adjustment_update',
      'adjustment_approve',
      'approval_submit',
      'approval_approve',
      'approval_reject',
      'approval_escalate',
      'export_generate',
    ]

    it('should expose exactly the 21 audit actions', () => {
      expect(actions).toHaveLength(21)
      expect(new Set(actions).size).toBe(21)
    })
  })

  describe('MappingType union', () => {
    const types: MappingType[] = ['1to1', '1toN', 'Nto1', 'complex']

    it('should expose exactly the 4 mapping types', () => {
      expect(types).toHaveLength(4)
      expect(new Set(types).size).toBe(4)
    })
  })

  describe('AdjustmentType union', () => {
    const types: AdjustmentType[] = [
      'revenue_recognition',
      'lease_classification',
      'financial_instrument',
      'business_combination',
      'deferred_tax',
      'retirement_benefit',
      'foreign_currency',
      'goodwill_impairment',
      'other',
    ]

    it('should expose exactly the 9 adjustment types', () => {
      expect(types).toHaveLength(9)
      expect(new Set(types).size).toBe(9)
    })
  })

  describe('DisclosureCategory union', () => {
    const categories: DisclosureCategory[] = [
      'significant_accounting_policies',
      'basis_of_conversion',
      'standard_differences',
      'adjusting_entries',
      'fair_value_measurement',
      'related_party',
      'subsequent_events',
      'commitments_contingencies',
      'segment_information',
      'foreign_currency',
      'revenue_recognition',
      'lease_obligations',
      'financial_instruments',
      'other',
    ]

    it('should expose exactly the 14 disclosure categories', () => {
      expect(categories).toHaveLength(14)
      expect(new Set(categories).size).toBe(14)
    })
  })

  describe('ReferenceType union', () => {
    const types: ReferenceType[] = [
      'ASBJ_statement',
      'ASBJ_guidance',
      'JICPA_guideline',
      'ASC_topic',
      'ASC_subtopic',
      'ASC_section',
      'ASC_paragraph',
      'IFRS_standard',
      'IAS_standard',
      'IFRIC_interpretation',
      'SIC_interpretation',
    ]

    it('should expose exactly the 11 reference types', () => {
      expect(types).toHaveLength(11)
      expect(new Set(types).size).toBe(11)
    })
  })

  describe('EntityType union', () => {
    const types: EntityType[] = [
      'mapping',
      'journal_conversion',
      'adjusting_entry',
      'fs_conversion',
    ]

    it('should expose exactly the 4 entity types', () => {
      expect(types).toHaveLength(4)
      expect(new Set(types).size).toBe(4)
    })
  })

  describe('RationaleType union', () => {
    const types: RationaleType[] = [
      'mapping_basis',
      'difference_explanation',
      'adjustment_reason',
      'disclosure_requirement',
      'measurement_change',
      'presentation_change',
    ]

    it('should expose exactly the 6 rationale types', () => {
      expect(types).toHaveLength(6)
      expect(new Set(types).size).toBe(6)
    })
  })

  describe('AccountingStandardInfo', () => {
    it('should construct a fully-populated info object', () => {
      const info: AccountingStandardInfo = {
        code: 'IFRS',
        name: '国際財務報告基準',
        nameEn: 'International Financial Reporting Standards',
        description: 'グローバルに適用される会計基準',
        countryCode: 'INT',
      }
      expect(info.code).toBe('IFRS')
      expect(info.name).toBe('国際財務報告基準')
      expect(info.countryCode).toBe('INT')
    })

    it('should allow description to be omitted', () => {
      const minimal: AccountingStandardInfo = {
        code: 'USGAAP',
        name: '米国基準',
        nameEn: 'US GAAP',
        countryCode: 'US',
      }
      expect(minimal.description).toBeUndefined()
      expectTypeOf<AccountingStandardInfo>().toMatchTypeOf<{ code: AccountingStandard }>()
    })
  })

  describe('ChartOfAccountItem', () => {
    const item: ChartOfAccountItem = {
      id: 'item-1',
      code: '1110',
      name: '現金',
      nameEn: 'Cash',
      standard: 'JGAAP',
      category: 'current_asset',
      subcategory: '流動資産',
      normalBalance: 'debit',
      parentId: 'root-1',
      level: 2,
      isConvertible: true,
      metadata: { sortOrder: 1, deprecated: false },
    }

    it('should expose identity, classification, and balance', () => {
      expect(item.id).toBe('item-1')
      expect(item.code).toBe('1110')
      expect(item.standard).toBe('JGAAP')
      expect(item.category).toBe('current_asset')
      expect(item.normalBalance).toBe('debit')
      expect(item.level).toBe(2)
      expect(item.isConvertible).toBe(true)
    })

    it('should hold arbitrary metadata', () => {
      expect(item.metadata).toEqual({ sortOrder: 1, deprecated: false })
    })

    it('should be minimal-constructible (optionals omitted, root level)', () => {
      const root: ChartOfAccountItem = {
        id: 'root-1',
        code: '1000',
        name: '資産',
        nameEn: 'Assets',
        standard: 'JGAAP',
        category: 'current_asset',
        normalBalance: 'debit',
        level: 0,
        isConvertible: false,
      }
      expect(root.subcategory).toBeUndefined()
      expect(root.parentId).toBeUndefined()
      expect(root.metadata).toBeUndefined()
      expect(root.level).toBe(0)
    })

    it('should type normalBalance as the debit/credit union', () => {
      expectTypeOf<ChartOfAccountItem['normalBalance']>().toEqualTypeOf<'debit' | 'credit'>()
    })
  })

  describe('ChartOfAccounts', () => {
    it('should construct a COA with items and lifecycle', () => {
      const coa: ChartOfAccounts = {
        id: 'coa-1',
        companyId: 'co-1',
        standard: 'JGAAP',
        name: '日本基準 科目マスタ',
        description: '標準科目体系',
        items: [
          {
            id: 'item-1',
            code: '1110',
            name: '現金',
            nameEn: 'Cash',
            standard: 'JGAAP',
            category: 'current_asset',
            normalBalance: 'debit',
            level: 0,
            isConvertible: true,
          },
        ],
        version: 2,
        isActive: true,
        isDefault: true,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(coa.companyId).toBe('co-1')
      expect(coa.items).toHaveLength(1)
      expect(coa.version).toBe(2)
      expect(coa.isActive).toBe(true)
      expect(coa.createdAt).toBe(CREATED)
    })

    it('should allow an empty item set and omitted description/default', () => {
      const empty: ChartOfAccounts = {
        id: 'coa-2',
        companyId: 'co-1',
        standard: 'IFRS',
        name: '空のCOA',
        items: [],
        version: 1,
        isActive: false,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(empty.items).toEqual([])
      expect(empty.description).toBeUndefined()
      expect(empty.isDefault).toBeUndefined()
      expect(empty.isActive).toBe(false)
    })
  })

  describe('MappingCondition', () => {
    it('should construct a numeric condition with the between operator', () => {
      const cond: MappingCondition = {
        field: 'amount',
        operator: 'between',
        value: 1000,
        targetAccountId: 'acc-1',
      }
      expect(cond.operator).toBe('between')
      expect(cond.value).toBe(1000)
    })

    it('should accept a string value with the contains operator', () => {
      const cond: MappingCondition = {
        field: 'name',
        operator: 'contains',
        value: '減価償却',
        targetAccountId: 'acc-2',
      }
      expect(cond.value).toBe('減価償却')
    })

    it('should type value as the string|number union', () => {
      expectTypeOf<MappingCondition['value']>().toEqualTypeOf<string | number>()
      expectTypeOf<MappingCondition['operator']>().toEqualTypeOf<
        'equals' | 'contains' | 'gt' | 'lt' | 'between'
      >()
    })
  })

  describe('ConversionRule', () => {
    it('should construct a percentage rule', () => {
      const rule: ConversionRule = {
        type: 'percentage',
        percentage: 60,
      }
      expect(rule.type).toBe('percentage')
      expect(rule.percentage).toBe(60)
      expect(rule.formula).toBeUndefined()
    })

    it('should construct a formula rule with conditions', () => {
      const rule: ConversionRule = {
        type: 'formula',
        formula: 'amount * 0.4',
        conditions: [{ field: 'amount', operator: 'gt', value: 0, targetAccountId: 'acc-1' }],
      }
      expect(rule.formula).toBe('amount * 0.4')
      expect(rule.conditions).toHaveLength(1)
      expect(rule.percentage).toBeUndefined()
    })

    it('should be minimal-constructible for a direct rule', () => {
      const direct: ConversionRule = { type: 'direct' }
      expect(direct.percentage).toBeUndefined()
      expect(direct.conditions).toBeUndefined()
    })

    it('should type type as the rule-type union', () => {
      expectTypeOf<ConversionRule['type']>().toEqualTypeOf<
        'direct' | 'percentage' | 'formula' | 'ai_suggested'
      >()
    })
  })

  describe('AccountMapping', () => {
    const mapping: AccountMapping = {
      id: 'map-1',
      sourceAccountId: 'src-1',
      sourceItemId: 'src-1',
      sourceAccountCode: '1110',
      sourceAccountName: '現金',
      targetAccountId: 'tgt-1',
      targetItemId: 'tgt-1',
      targetAccountCode: '1010',
      targetAccountName: 'Cash and cash equivalents',
      mappingType: '1to1',
      conversionRule: { type: 'direct' },
      percentage: 100,
      confidence: 0.95,
      isManualReview: false,
      notes: '直接的な対応',
    }

    it('should expose source/target identity and mapping metadata', () => {
      expect(mapping.sourceAccountCode).toBe('1110')
      expect(mapping.targetAccountCode).toBe('1010')
      expect(mapping.mappingType).toBe('1to1')
      expect(mapping.confidence).toBe(0.95)
      expect(mapping.isManualReview).toBe(false)
    })

    it('should carry an optional nested conversion rule', () => {
      expect(mapping.conversionRule?.type).toBe('direct')
    })

    it('should be minimal-constructible (alias + rule + percentage + notes omitted)', () => {
      const minimal: AccountMapping = {
        id: 'map-2',
        sourceAccountId: 'src-2',
        sourceAccountCode: '1110',
        sourceAccountName: '現金',
        targetAccountId: 'tgt-2',
        targetAccountCode: '1010',
        targetAccountName: 'Cash',
        mappingType: 'Nto1',
        confidence: 0,
        isManualReview: true,
      }
      expect(minimal.sourceItemId).toBeUndefined()
      expect(minimal.targetItemId).toBeUndefined()
      expect(minimal.conversionRule).toBeUndefined()
      expect(minimal.percentage).toBeUndefined()
      expect(minimal.notes).toBeUndefined()
      expect(minimal.confidence).toBe(0)
    })

    it('should type confidence as a number bounded 0-1 by convention', () => {
      expectTypeOf<AccountMapping['confidence']>().toEqualTypeOf<number>()
      expectTypeOf<AccountMapping['mappingType']>().toEqualTypeOf<MappingType>()
    })
  })

  describe('ConversionProgress', () => {
    it('should accept Date timestamps', () => {
      const progress: ConversionProgress = {
        status: 'converting',
        progress: 42,
        processedJournals: 420,
        totalJournals: 1000,
        errors: [],
        startedAt: CREATED,
        estimatedCompletion: COMPLETED,
        currentItem: 'item-42',
      }
      expect(progress.progress).toBe(42)
      expect(progress.processedJournals).toBe(420)
      expect(progress.startedAt).toBe(CREATED)
    })

    it('should accept ISO string timestamps (serialization shape)', () => {
      const progress: ConversionProgress = {
        status: 'completed',
        progress: 100,
        processedJournals: 1000,
        totalJournals: 1000,
        errors: [{ code: 'WARN', message: 'minor' }],
        startedAt: '2024-01-15T00:00:00.000Z',
      }
      expect(typeof progress.startedAt).toBe('string')
      expect(progress.errors).toHaveLength(1)
    })

    it('should be minimal-constructible', () => {
      const minimal: ConversionProgress = {
        status: 'draft',
        progress: 0,
        processedJournals: 0,
        totalJournals: 0,
        errors: [],
      }
      expect(minimal.startedAt).toBeUndefined()
      expect(minimal.estimatedCompletion).toBeUndefined()
      expect(minimal.currentItem).toBeUndefined()
      expectTypeOf<ConversionProgress['startedAt']>().toEqualTypeOf<Date | string | undefined>()
    })
  })

  describe('ConversionSettings', () => {
    it('should construct a fully-populated settings object', () => {
      const settings: ConversionSettings = {
        includeJournals: true,
        includeFinancialStatements: true,
        generateAdjustingEntries: true,
        aiAssistedMapping: true,
        currencyConversionRate: 0.0067,
        functionalCurrency: 'JPY',
        presentationCurrency: 'USD',
      }
      expect(settings.generateAdjustingEntries).toBe(true)
      expect(settings.currencyConversionRate).toBe(0.0067)
      expect(settings.presentationCurrency).toBe('USD')
    })

    it('should be minimal-constructible (currency block optional)', () => {
      const minimal: ConversionSettings = {
        includeJournals: false,
        includeFinancialStatements: false,
        generateAdjustingEntries: false,
        aiAssistedMapping: false,
      }
      expect(minimal.currencyConversionRate).toBeUndefined()
      expect(minimal.functionalCurrency).toBeUndefined()
      expect(minimal.presentationCurrency).toBeUndefined()
    })
  })

  describe('ConversionStatistics', () => {
    it('should construct statistics with all counts', () => {
      const stats: ConversionStatistics = {
        totalAccounts: 100,
        mappedAccounts: 80,
        reviewRequiredCount: 5,
        totalJournals: 1000,
        convertedJournals: 950,
        adjustingEntryCount: 12,
        averageConfidence: 0.92,
      }
      expect(stats.mappedAccounts).toBe(80)
      expect(stats.averageConfidence).toBe(0.92)
    })

    it('should accept a zeroed-out progress snapshot', () => {
      const empty: ConversionStatistics = {
        totalAccounts: 0,
        mappedAccounts: 0,
        reviewRequiredCount: 0,
        totalJournals: 0,
        convertedJournals: 0,
        adjustingEntryCount: 0,
        averageConfidence: 0,
      }
      expect(Object.values(empty).every((v) => v === 0)).toBe(true)
    })
  })

  describe('ConversionProject', () => {
    const project: ConversionProject = {
      id: 'proj-1',
      companyId: 'co-1',
      name: 'JGAAP→IFRS変換',
      description: '2024年度',
      sourceStandard: 'JGAAP',
      targetStandard: 'IFRS',
      targetCoaId: 'coa-1',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: 'converting',
      progress: 50,
      settings: {
        includeJournals: true,
        includeFinancialStatements: true,
        generateAdjustingEntries: true,
        aiAssistedMapping: true,
      },
      statistics: {
        totalAccounts: 100,
        mappedAccounts: 80,
        reviewRequiredCount: 5,
        totalJournals: 1000,
        convertedJournals: 950,
        adjustingEntryCount: 12,
        averageConfidence: 0.92,
      },
      createdBy: 'user-1',
      createdAt: CREATED,
      updatedAt: UPDATED,
      completedAt: COMPLETED,
    }

    it('should expose core project identity and conversion direction', () => {
      expect(project.id).toBe('proj-1')
      expect(project.sourceStandard).toBe('JGAAP')
      expect(project.targetStandard).toBe('IFRS')
      expect(project.targetCoaId).toBe('coa-1')
    })

    it('should track progress and lifecycle', () => {
      expect(project.status).toBe('converting')
      expect(project.progress).toBe(50)
      expect(project.createdBy).toBe('user-1')
      expect(project.completedAt).toBe(COMPLETED)
      expect(project.statistics?.mappedAccounts).toBe(80)
    })

    it('should be minimal-constructible (description/statistics/completedAt omitted)', () => {
      const minimal: ConversionProject = {
        id: 'proj-2',
        companyId: 'co-1',
        name: 'Draft project',
        sourceStandard: 'JGAAP',
        targetStandard: 'USGAAP',
        targetCoaId: 'coa-2',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        status: 'draft',
        progress: 0,
        settings: {
          includeJournals: false,
          includeFinancialStatements: false,
          generateAdjustingEntries: false,
          aiAssistedMapping: false,
        },
        createdBy: 'user-2',
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(minimal.description).toBeUndefined()
      expect(minimal.statistics).toBeUndefined()
      expect(minimal.completedAt).toBeUndefined()
    })
  })

  describe('ConvertedJournalLine & JournalConversion', () => {
    it('should construct a balanced converted line', () => {
      const line: ConvertedJournalLine = {
        sourceAccountCode: '1110',
        sourceAccountName: '現金',
        targetAccountCode: '1010',
        targetAccountName: 'Cash',
        debitAmount: 1000,
        creditAmount: 0,
        mappingId: 'map-1',
      }
      expect(line.debitAmount).toBe(1000)
      expect(line.creditAmount).toBe(0)
    })

    it('should accept zero-amount lines', () => {
      const line: ConvertedJournalLine = {
        sourceAccountCode: '1110',
        sourceAccountName: '現金',
        targetAccountCode: '1010',
        targetAccountName: 'Cash',
        debitAmount: 0,
        creditAmount: 0,
        mappingId: 'map-1',
      }
      expect(line.debitAmount + line.creditAmount).toBe(0)
    })

    it('should construct a journal conversion with review state', () => {
      const conversion: JournalConversion = {
        sourceJournalId: 'j-1',
        sourceDate: PERIOD_START,
        sourceDescription: '売上計上',
        lines: [
          {
            sourceAccountCode: '4110',
            sourceAccountName: '売上',
            targetAccountCode: '4000',
            targetAccountName: 'Revenue',
            debitAmount: 0,
            creditAmount: 1000,
            mappingId: 'map-2',
          },
        ],
        mappingConfidence: 0.88,
        requiresReview: true,
        reviewNotes: 'マッピング要確認',
      }
      expect(conversion.lines).toHaveLength(1)
      expect(conversion.mappingConfidence).toBe(0.88)
      expect(conversion.requiresReview).toBe(true)
      expect(conversion.reviewNotes).toBe('マッピング要確認')
    })

    it('should be minimal-constructible without review notes', () => {
      const minimal: JournalConversion = {
        sourceJournalId: 'j-2',
        sourceDate: PERIOD_START,
        sourceDescription: '',
        lines: [],
        mappingConfidence: 0,
        requiresReview: false,
      }
      expect(minimal.reviewNotes).toBeUndefined()
      expect(minimal.lines).toEqual([])
    })
  })

  describe('AdjustingEntryLine & AdjustingEntry', () => {
    it('should construct an adjusting entry with balanced lines', () => {
      const entry: AdjustingEntry = {
        id: 'adj-1',
        projectId: 'proj-1',
        type: 'lease_classification',
        description: 'リース会計基準の差異調整',
        descriptionEn: 'Lease classification adjustment',
        lines: [
          { accountCode: '1600', accountName: 'リース資産', debit: 1000, credit: 0 },
          { accountCode: '2100', accountName: 'リース負債', debit: 0, credit: 1000 },
        ],
        ifrsReference: 'IFRS 16',
        usgaapReference: 'ASC 842',
        aiSuggested: true,
        isApproved: false,
      }
      expect(entry.type).toBe('lease_classification')
      expect(entry.lines).toHaveLength(2)
      const debit = entry.lines.reduce((s, l) => s + l.debit, 0)
      const credit = entry.lines.reduce((s, l) => s + l.credit, 0)
      expect(debit).toBe(credit)
      expect(entry.ifrsReference).toBe('IFRS 16')
    })

    it('should be minimal-constructible for a manual approved entry', () => {
      const minimal: AdjustingEntry = {
        id: 'adj-2',
        projectId: 'proj-1',
        type: 'other',
        description: 'その他の調整',
        lines: [],
        aiSuggested: false,
        isApproved: true,
      }
      expect(minimal.descriptionEn).toBeUndefined()
      expect(minimal.ifrsReference).toBeUndefined()
      expect(minimal.usgaapReference).toBeUndefined()
      expect(minimal.isApproved).toBe(true)
    })

    it('should type line debit/credit as numbers', () => {
      expectTypeOf<AdjustingEntryLine['debit']>().toEqualTypeOf<number>()
      expectTypeOf<AdjustingEntryLine['credit']>().toEqualTypeOf<number>()
    })
  })

  describe('DisclosureNote', () => {
    it('should construct a bilingual disclosure note', () => {
      const note: DisclosureNote = {
        id: 'note-1',
        category: 'significant_accounting_policies',
        title: '重要な会計方針',
        titleEn: 'Significant Accounting Policies',
        content: '当社は…',
        contentEn: 'The Company...',
        standardReference: 'IAS 1',
        order: 1,
        isGenerated: true,
      }
      expect(note.category).toBe('significant_accounting_policies')
      expect(note.order).toBe(1)
      expect(note.standardReference).toBe('IAS 1')
    })

    it('should be minimal-constructible (English content omitted)', () => {
      const minimal: DisclosureNote = {
        id: 'note-2',
        category: 'other',
        title: 'その他',
        titleEn: 'Other',
        content: '補足情報',
        standardReference: '—',
        order: 99,
        isGenerated: false,
      }
      expect(minimal.contentEn).toBeUndefined()
    })
  })

  describe('DisclosureTable & DisclosureSection', () => {
    it('should construct a disclosure table with headers and rows', () => {
      const table: DisclosureTable = {
        id: 'tbl-1',
        title: 'リース負債の満期分析',
        titleEn: 'Maturity analysis of lease liabilities',
        headers: ['1年以内', '1年超'],
        rows: [['500', '1500']],
        footnotes: ['金額は万円単位'],
      }
      expect(table.headers).toEqual(['1年以内', '1年超'])
      expect(table.rows[0]).toEqual(['500', '1500'])
    })

    it('should construct a nested disclosure section', () => {
      const section: DisclosureSection = {
        id: 'sec-1',
        title: '財務諸表の注記',
        titleEn: 'Notes to Financial Statements',
        content: '概要',
        contentEn: 'Summary',
        order: 1,
        subsections: [
          {
            id: 'sub-1',
            title: '後発事象',
            titleEn: 'Subsequent Events',
            content: '後発事象の内容',
            order: 1,
          },
        ],
        tables: [],
      }
      expect(section.subsections).toHaveLength(1)
      expect(section.tables).toEqual([])
    })

    it('should be minimal-constructible', () => {
      const minimal: DisclosureSection = {
        id: 'sec-2',
        title: 'セクション',
        titleEn: 'Section',
        content: '',
        order: 0,
      }
      expect(minimal.subsections).toBeUndefined()
      expect(minimal.tables).toBeUndefined()
      expect(minimal.contentEn).toBeUndefined()
    })
  })

  describe('DisclosureStandardReference & DisclosureDocument', () => {
    it('should construct a standard reference', () => {
      const ref: DisclosureStandardReference = {
        id: 'ref-1',
        referenceNumber: 'IFRS 16',
        title: 'リース',
        source: 'IASB',
        order: 1,
      }
      expect(ref.referenceNumber).toBe('IFRS 16')
    })

    it('should construct a fully-populated disclosure document', () => {
      const doc: DisclosureDocument = {
        id: 'doc-1',
        projectId: 'proj-1',
        category: 'standard_differences',
        title: '基準間の差異',
        titleEn: 'Standard Differences',
        content: 'JGAAPとIFRSの主な差異',
        contentEn: 'Key differences',
        sections: [],
        standardReferences: [
          { id: 'ref-1', referenceNumber: 'IFRS 16', title: 'リース', source: 'IASB' },
        ],
        relatedRationaleIds: ['rat-1', 'rat-2'],
        isGenerated: true,
        isAiEnhanced: true,
        generatedAt: GENERATED_AT,
        updatedAt: UPDATED,
        reviewedBy: 'user-1',
        reviewedAt: COMPLETED,
        sortOrder: 2,
      }
      expect(doc.relatedRationaleIds).toEqual(['rat-1', 'rat-2'])
      expect(doc.standardReferences).toHaveLength(1)
      expect(doc.isAiEnhanced).toBe(true)
      expect(doc.reviewedBy).toBe('user-1')
    })

    it('should be minimal-constructible (no review, no English content)', () => {
      const minimal: DisclosureDocument = {
        id: 'doc-2',
        projectId: 'proj-1',
        category: 'other',
        title: 'メモ',
        titleEn: 'Memo',
        content: 'メモ内容',
        sections: [],
        standardReferences: [],
        relatedRationaleIds: [],
        isGenerated: false,
        isAiEnhanced: false,
        generatedAt: GENERATED_AT,
        updatedAt: UPDATED,
        sortOrder: 0,
      }
      expect(minimal.contentEn).toBeUndefined()
      expect(minimal.reviewedBy).toBeUndefined()
      expect(minimal.reviewedAt).toBeUndefined()
    })
  })

  describe('AIEnhancedDisclosure', () => {
    it('should construct an AI enhancement response', () => {
      const enhanced: AIEnhancedDisclosure = {
        enhancedContent: '拡充された開示内容',
        enhancedContentEn: 'Enhanced disclosure',
        addedReferences: ['IAS 1.118'],
        improvements: ['根拠の追加'],
      }
      expect(enhanced.addedReferences).toEqual(['IAS 1.118'])
      expect(enhanced.improvements).toHaveLength(1)
    })
  })

  describe('ConversionWarning & ConversionError', () => {
    it('should construct a warning with details', () => {
      const warning: ConversionWarning = {
        code: 'LOW_CONFIDENCE',
        message: 'マッピング信頼度が低いです',
        details: { confidence: 0.3, accountId: 'acc-1' },
      }
      expect(warning.details?.confidence).toBe(0.3)
    })

    it('should be minimal-constructible', () => {
      const minimal: ConversionWarning = { code: 'WARN', message: '注意' }
      expect(minimal.details).toBeUndefined()
    })

    it('should construct an error with affected item and stack', () => {
      const error: ConversionError = {
        code: 'MAPPING_NOT_FOUND',
        message: 'マッピングが存在しません',
        affectedItem: 'acc-999',
        stack: 'Error: ...\n    at convert (...)',
      }
      expect(error.affectedItem).toBe('acc-999')
      expect(error.stack).toContain('at convert')
    })

    it('should be minimal-constructible', () => {
      const minimal: ConversionError = { code: 'ERR', message: '失敗' }
      expect(minimal.affectedItem).toBeUndefined()
      expect(minimal.stack).toBeUndefined()
    })
  })

  describe('ConvertedBalanceSheet', () => {
    it('should construct a balanced BS', () => {
      const bs: ConvertedBalanceSheet = {
        asOfDate: PERIOD_END,
        assets: [
          { code: '1010', name: '現金', nameEn: 'Cash', amount: 1000 },
          {
            code: '1600',
            name: 'リース資産',
            nameEn: 'ROU asset',
            amount: 500,
            sourceAccountCode: '1600',
          },
        ],
        liabilities: [{ code: '2100', name: 'リース負債', nameEn: 'Lease liability', amount: 500 }],
        equity: [{ code: '3000', name: '資本金', nameEn: 'Capital', amount: 1000 }],
        totalAssets: 1500,
        totalLiabilities: 500,
        totalEquity: 1000,
      }
      expect(bs.totalAssets).toBe(bs.totalLiabilities + bs.totalEquity)
      expect(bs.assets).toHaveLength(2)
      expect(bs.assets[1].sourceAccountCode).toBe('1600')
      expect(bs.assets[0].sourceAccountCode).toBeUndefined()
    })

    it('should accept a zeroed BS', () => {
      const empty: ConvertedBalanceSheet = {
        asOfDate: PERIOD_END,
        assets: [],
        liabilities: [],
        equity: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      }
      expect(empty.totalAssets).toBe(0)
    })
  })

  describe('ConvertedProfitLoss', () => {
    it('should construct a P&L with derived subtotals', () => {
      const pl: ConvertedProfitLoss = {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        revenue: [{ code: '4000', name: '売上', nameEn: 'Revenue', amount: 5000 }],
        costOfSales: [{ code: '5000', name: '売上原価', nameEn: 'COGS', amount: 3000 }],
        sgaExpenses: [{ code: '6000', name: '販売費', nameEn: 'SGA', amount: 1000 }],
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        grossProfit: 2000,
        operatingIncome: 1000,
        ordinaryIncome: 1000,
        incomeBeforeTax: 1000,
        netIncome: 800,
      }
      expect(pl.grossProfit).toBe(pl.revenue[0].amount - pl.costOfSales[0].amount)
      expect(pl.netIncome).toBe(800)
    })
  })

  describe('ConvertedCashFlow', () => {
    it('should construct a CF statement reconciling to net change', () => {
      const cf: ConvertedCashFlow = {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        operatingActivities: [{ code: 'OP-1', name: '営業CF', nameEn: 'Operating', amount: 1200 }],
        investingActivities: [{ code: 'INV-1', name: '投資CF', nameEn: 'Investing', amount: -500 }],
        financingActivities: [{ code: 'FIN-1', name: '財務CF', nameEn: 'Financing', amount: -200 }],
        netCashFromOperating: 1200,
        netCashFromInvesting: -500,
        netCashFromFinancing: -200,
        netChangeInCash: 500,
      }
      expect(cf.netChangeInCash).toBe(
        cf.netCashFromOperating + cf.netCashFromInvesting + cf.netCashFromFinancing
      )
    })
  })

  describe('MappingSuggestion & MappingSuggestionAlternative', () => {
    it('should construct a standalone mapping-suggestion alternative', () => {
      const alt: MappingSuggestionAlternative = {
        code: '1020',
        name: 'Short-term investments',
        confidence: 0.4,
      }
      expect(alt.code).toBe('1020')
      expect(alt.confidence).toBeLessThanOrEqual(1)
      expectTypeOf<MappingSuggestionAlternative>().toHaveProperty('code')
      expectTypeOf<MappingSuggestionAlternative>().toHaveProperty('confidence')
      expectTypeOf<
        MappingSuggestion['alternatives'][number]
      >().toEqualTypeOf<MappingSuggestionAlternative>()
    })

    it('should construct an AI mapping suggestion with alternatives', () => {
      const suggestion: MappingSuggestion = {
        sourceAccountCode: '1110',
        sourceAccountName: '現金',
        suggestedTargetCode: '1010',
        suggestedTargetName: 'Cash and cash equivalents',
        confidence: 0.9,
        reasoning: '名前と性質が一致',
        alternatives: [
          { code: '1020', name: 'Short-term investments', confidence: 0.4 },
          { code: '1030', name: 'Restricted cash', confidence: 0.2 },
        ],
      }
      expect(suggestion.confidence).toBeGreaterThan(suggestion.alternatives[0].confidence)
      expect(suggestion.alternatives).toHaveLength(2)
    })

    it('should allow an empty alternatives list', () => {
      const minimal: MappingSuggestion = {
        sourceAccountCode: '1110',
        sourceAccountName: '現金',
        suggestedTargetCode: '1010',
        suggestedTargetName: 'Cash',
        confidence: 0,
        reasoning: '',
        alternatives: [],
      }
      expect(minimal.alternatives).toEqual([])
    })
  })

  describe('AdjustmentRecommendation & AdjustmentRecommendationImpact', () => {
    it('should construct a high-priority recommendation with impact', () => {
      const rec: AdjustmentRecommendation = {
        type: 'deferred_tax',
        priority: 'high',
        title: '繰延税金資産の計上',
        description: '暫定差異に対する繰延税金',
        estimatedImpact: {
          assetChange: 200,
          liabilityChange: 0,
          equityChange: 0,
          netIncomeChange: 200,
        },
        reasoning: 'IFRSでは認識が必須',
        references: ['IAS 12'],
      }
      expect(rec.priority).toBe('high')
      expect(rec.estimatedImpact.netIncomeChange).toBe(200)
      expectTypeOf<AdjustmentRecommendation['priority']>().toEqualTypeOf<
        'high' | 'medium' | 'low'
      >()
    })

    it('should allow impact to be entirely empty (all optionals)', () => {
      const impact: AdjustmentRecommendationImpact = {}
      expect(impact.assetChange).toBeUndefined()
      expect(impact.netIncomeChange).toBeUndefined()
    })
  })

  describe('RiskAssessment', () => {
    it('should construct a risk assessment', () => {
      const risk: RiskAssessment = {
        category: 'mapping_quality',
        riskLevel: 'medium',
        description: '低信頼度マッピングが多数存在',
        mitigationSuggestion: '手動レビューを推奨',
      }
      expect(risk.riskLevel).toBe('medium')
      expectTypeOf<RiskAssessment['riskLevel']>().toEqualTypeOf<'low' | 'medium' | 'high'>()
    })
  })

  describe('AIConversionAnalysis', () => {
    it('should construct an analysis bundle', () => {
      const analysis: AIConversionAnalysis = {
        id: 'ai-1',
        projectId: 'proj-1',
        mappingSuggestions: [],
        adjustmentRecommendations: [],
        riskAssessments: [],
        qualityScore: 0.87,
        generatedAt: GENERATED_AT,
        modelUsed: 'claude-sonnet-4-6-20250514',
        temperature: 0.2,
      }
      expect(analysis.qualityScore).toBeLessThanOrEqual(1)
      expect(analysis.modelUsed).toBe('claude-sonnet-4-6-20250514')
      expect(analysis.temperature).toBe(0.2)
    })
  })

  describe('ConversionResult', () => {
    it('should construct a fully-populated result', () => {
      const result: ConversionResult = {
        id: 'res-1',
        projectId: 'proj-1',
        journalConversions: [],
        balanceSheet: {
          asOfDate: PERIOD_END,
          assets: [],
          liabilities: [],
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
        adjustingEntries: [],
        disclosures: [],
        aiAnalysis: {
          id: 'ai-1',
          projectId: 'proj-1',
          mappingSuggestions: [],
          adjustmentRecommendations: [],
          riskAssessments: [],
          qualityScore: 0.9,
          generatedAt: GENERATED_AT,
          modelUsed: 'claude-sonnet-4-6-20250514',
          temperature: 0,
        },
        conversionDate: COMPLETED,
        conversionDurationMs: 12345,
        warnings: [],
        errors: [],
        configVersion: 'v1.2.0',
      }
      expect(result.projectId).toBe('proj-1')
      expect(result.conversionDurationMs).toBe(12345)
      expect(result.aiAnalysis?.qualityScore).toBe(0.9)
      expect(result.configVersion).toBe('v1.2.0')
    })

    it('should be minimal-constructible (all optional projections omitted)', () => {
      const minimal: ConversionResult = {
        id: 'res-2',
        projectId: 'proj-1',
        conversionDate: COMPLETED,
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }
      expect(minimal.balanceSheet).toBeUndefined()
      expect(minimal.profitLoss).toBeUndefined()
      expect(minimal.cashFlow).toBeUndefined()
      expect(minimal.aiAnalysis).toBeUndefined()
      expect(minimal.configVersion).toBeUndefined()
      expectTypeOf<ConversionResult['conversionDurationMs']>().toEqualTypeOf<number>()
    })
  })

  describe('ExportConfig & ExportResult', () => {
    it('should construct an export config', () => {
      const config: ExportConfig = {
        format: 'excel',
        includeJournals: true,
        includeFinancialStatements: true,
        includeAdjustingEntries: false,
        includeDisclosures: true,
        includeAIAnalysis: false,
        language: 'both',
        currency: 'target',
      }
      expect(config.format).toBe('excel')
      expectTypeOf<ExportConfig['format']>().toEqualTypeOf<'pdf' | 'excel' | 'csv' | 'json'>()
      expectTypeOf<ExportConfig['language']>().toEqualTypeOf<'ja' | 'en' | 'both'>()
      expectTypeOf<ExportConfig['currency']>().toEqualTypeOf<'source' | 'target' | 'both'>()
    })

    it('should construct an export result with expiry', () => {
      const result: ExportResult = {
        id: 'exp-1',
        projectId: 'proj-1',
        format: 'pdf',
        fileUrl: 'https://example.com/x.pdf',
        fileName: 'conversion.pdf',
        fileSize: 4096,
        generatedAt: GENERATED_AT,
        expiresAt: COMPLETED,
      }
      expect(result.fileSize).toBe(4096)
      expect(result.expiresAt).toBe(COMPLETED)
    })

    it('should be minimal-constructible without url/expiry', () => {
      const minimal: ExportResult = {
        id: 'exp-2',
        projectId: 'proj-1',
        format: 'csv',
        fileName: 'out.csv',
        fileSize: 0,
        generatedAt: GENERATED_AT,
      }
      expect(minimal.fileUrl).toBeUndefined()
      expect(minimal.expiresAt).toBeUndefined()
    })
  })

  describe('Request DTOs', () => {
    it('CreateConversionProjectRequest narrows targetStandard to USGAAP|IFRS', () => {
      const req: CreateConversionProjectRequest = {
        name: '新規変換',
        targetStandard: 'IFRS',
        targetCoaId: 'coa-1',
        periodStart: '2024-04-01',
        periodEnd: '2025-03-31',
        settings: { includeJournals: true },
      }
      expect(req.targetStandard).toBe('IFRS')
      expectTypeOf<CreateConversionProjectRequest['targetStandard']>().toEqualTypeOf<
        'USGAAP' | 'IFRS'
      >()
      expectTypeOf<CreateConversionProjectRequest['periodStart']>().toEqualTypeOf<string>()
    })

    it('CreateConversionProjectRequest allows description to be omitted', () => {
      const minimal: CreateConversionProjectRequest = {
        name: '最小',
        targetStandard: 'USGAAP',
        targetCoaId: 'coa-1',
        periodStart: '2024-04-01',
        periodEnd: '2025-03-31',
        settings: {},
      }
      expect(minimal.description).toBeUndefined()
    })

    it('ExecuteConversionRequest defaults dryRun to optional', () => {
      const req: ExecuteConversionRequest = { projectId: 'proj-1', dryRun: true }
      const minimal: ExecuteConversionRequest = { projectId: 'proj-1' }
      expect(req.dryRun).toBe(true)
      expect(minimal.dryRun).toBeUndefined()
      expectTypeOf<ExecuteConversionRequest['projectId']>().toEqualTypeOf<string>()
    })

    it('MappingSuggestionRequest defaults sourceAccountCodes to optional', () => {
      const req: MappingSuggestionRequest = {
        projectId: 'proj-1',
        sourceAccountCodes: ['1110', '4110'],
      }
      const minimal: MappingSuggestionRequest = { projectId: 'proj-1' }
      expect(req.sourceAccountCodes).toEqual(['1110', '4110'])
      expect(minimal.sourceAccountCodes).toBeUndefined()
    })
  })

  describe('ConversionListResponse', () => {
    it('should wrap a paginated project list', () => {
      const res: ConversionListResponse = {
        data: [
          {
            id: 'proj-1',
            companyId: 'co-1',
            name: 'p1',
            sourceStandard: 'JGAAP',
            targetStandard: 'IFRS',
            targetCoaId: 'coa-1',
            periodStart: PERIOD_START,
            periodEnd: PERIOD_END,
            status: 'completed',
            progress: 100,
            settings: {
              includeJournals: true,
              includeFinancialStatements: true,
              generateAdjustingEntries: true,
              aiAssistedMapping: false,
            },
            createdBy: 'u1',
            createdAt: CREATED,
            updatedAt: UPDATED,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }
      expect(res.data).toHaveLength(1)
      expect(res.pagination.totalPages).toBe(1)
      expectTypeOf<ConversionListResponse['pagination']>().toEqualTypeOf<{
        page: number
        limit: number
        total: number
        totalPages: number
      }>()
    })

    it('should accept an empty page', () => {
      const empty: ConversionListResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }
      expect(empty.data).toEqual([])
      expect(empty.pagination.total).toBe(0)
    })
  })

  describe('StandardReference & StandardReferenceUsage', () => {
    it('should construct a standard reference with lifecycle', () => {
      const ref: StandardReference = {
        id: 'sr-1',
        standard: 'IFRS',
        referenceType: 'IFRS_standard',
        referenceNumber: 'IFRS 16',
        title: 'リース',
        titleEn: 'Leases',
        description: 'リースの会計処理',
        effectiveDate: PERIOD_START,
        isActive: true,
        officialUrl: 'https://www.ifrs.org/issued-standards/',
        keywords: ['lease', 'right-of-use'],
      }
      expect(ref.referenceType).toBe('IFRS_standard')
      expect(ref.keywords).toEqual(['lease', 'right-of-use'])
    })

    it('should be minimal-constructible (only required fields)', () => {
      const minimal: StandardReference = {
        id: 'sr-2',
        standard: 'JGAAP',
        referenceType: 'ASBJ_statement',
        referenceNumber: '企業会計原則',
        title: '企業会計原則',
        isActive: true,
      }
      expect(minimal.titleEn).toBeUndefined()
      expect(minimal.effectiveDate).toBeUndefined()
      expect(minimal.supersededDate).toBeUndefined()
      expect(minimal.officialUrl).toBeUndefined()
      expect(minimal.keywords).toBeUndefined()
    })

    it('should pair a reference with a usage count', () => {
      const usage: StandardReferenceUsage = {
        reference: {
          id: 'sr-1',
          standard: 'IFRS',
          referenceType: 'IFRS_standard',
          referenceNumber: 'IFRS 16',
          title: 'リース',
          isActive: true,
        },
        usageCount: 7,
      }
      expect(usage.usageCount).toBe(7)
      expect(usage.reference.referenceNumber).toBe('IFRS 16')
    })
  })

  describe('ConversionRationale', () => {
    it('should construct a fully-populated rationale', () => {
      const rationale: ConversionRationale = {
        id: 'rat-1',
        projectId: 'proj-1',
        entityType: 'mapping',
        entityId: 'map-1',
        rationaleType: 'mapping_basis',
        summary: '現金→Cashの対応根拠',
        summaryEn: 'Cash mapping basis',
        detailedExplanation: '両者とも流動性の高い資産',
        impactAmount: 0,
        impactDirection: 'reclassification',
        isAiGenerated: true,
        aiModelUsed: 'claude-sonnet-4-6-20250514',
        aiConfidence: 0.9,
        isReviewed: false,
        createdBy: 'user-1',
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(rationale.entityType).toBe('mapping')
      expect(rationale.rationaleType).toBe('mapping_basis')
      expect(rationale.impactDirection).toBe('reclassification')
      expect(rationale.aiConfidence).toBe(0.9)
      expectTypeOf<ConversionRationale['impactDirection']>().toEqualTypeOf<
        'increase' | 'decrease' | 'reclassification' | undefined
      >()
    })

    it('should be minimal-constructible', () => {
      const minimal: ConversionRationale = {
        id: 'rat-2',
        projectId: 'proj-1',
        entityType: 'adjusting_entry',
        entityId: 'adj-1',
        rationaleType: 'adjustment_reason',
        summary: '調整理由',
        isAiGenerated: false,
        isReviewed: true,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }
      expect(minimal.sourceReference).toBeUndefined()
      expect(minimal.targetReference).toBeUndefined()
      expect(minimal.detailedExplanation).toBeUndefined()
      expect(minimal.impactAmount).toBeUndefined()
      expect(minimal.aiConfidence).toBeUndefined()
      expect(minimal.reviewedBy).toBeUndefined()
    })
  })

  describe('RationaleAuditEntry', () => {
    it('should construct an audit entry capturing a change', () => {
      const entry: RationaleAuditEntry = {
        id: 'aud-1',
        rationaleId: 'rat-1',
        action: 'update',
        previousValue: { summary: '旧' },
        newValue: { summary: '新' },
        changedFields: ['summary'],
        userId: 'user-1',
        userName: '山田',
        userRole: 'accountant',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        notes: '文案修正',
        createdAt: CREATED,
      }
      expect(entry.action).toBe('update')
      expect(entry.changedFields).toEqual(['summary'])
    })

    it('should be minimal-constructible for a create action', () => {
      const minimal: RationaleAuditEntry = {
        id: 'aud-2',
        rationaleId: 'rat-1',
        action: 'create',
        newValue: { summary: '新規' },
        createdAt: CREATED,
      }
      expect(minimal.previousValue).toBeUndefined()
      expect(minimal.changedFields).toBeUndefined()
      expect(minimal.userId).toBeUndefined()
    })

    it('should type action as the audit-action union', () => {
      expectTypeOf<RationaleAuditEntry['action']>().toEqualTypeOf<
        'create' | 'update' | 'review' | 'approve' | 'reject'
      >()
    })
  })

  describe('Rationale input/filter DTOs', () => {
    it('CreateRationaleInput requires identity and omits audit fields', () => {
      const input: CreateRationaleInput = {
        projectId: 'proj-1',
        entityType: 'mapping',
        entityId: 'map-1',
        rationaleType: 'mapping_basis',
        summary: '根拠',
        isAiGenerated: true,
        aiConfidence: 0.8,
      }
      expect(input.summary).toBe('根拠')
      expectTypeOf<CreateRationaleInput>().not.toHaveProperty('id')
      expectTypeOf<CreateRationaleInput>().not.toHaveProperty('createdAt')
      expectTypeOf<CreateRationaleInput>().not.toHaveProperty('updatedAt')
    })

    it('UpdateRationaleInput is fully optional', () => {
      const update: UpdateRationaleInput = { summary: '更新', impactAmount: 100 }
      const empty: UpdateRationaleInput = {}
      expect(update.impactAmount).toBe(100)
      expect(Object.keys(empty)).toHaveLength(0)
    })

    it('RationaleFilters is fully optional', () => {
      const filters: RationaleFilters = {
        entityType: 'mapping',
        rationaleType: 'difference_explanation',
        isReviewed: false,
        isAiGenerated: true,
      }
      const empty: RationaleFilters = {}
      expect(filters.isReviewed).toBe(false)
      expect(Object.keys(empty)).toHaveLength(0)
    })
  })

  describe('AuditReport bundle', () => {
    it('should construct a full audit report', () => {
      const report: AuditReport = {
        projectId: 'proj-1',
        projectName: 'JGAAP→IFRS変換',
        generatedAt: GENERATED_AT,
        summary: {
          totalRationales: 50,
          reviewedRationales: 30,
          aiGeneratedRationales: 20,
          pendingReview: 20,
        },
        byEntityType: { mapping: 30, journal_conversion: 10, adjusting_entry: 8, fs_conversion: 2 },
        byRationaleType: {
          mapping_basis: 20,
          difference_explanation: 10,
          adjustment_reason: 8,
          disclosure_requirement: 5,
          measurement_change: 4,
          presentation_change: 3,
        },
        unreviewedItems: [
          { entityType: 'mapping', entityId: 'map-1', summary: '未レビュー', createdAt: CREATED },
        ],
        significantImpacts: [
          { entityType: 'adjusting_entry', entityId: 'adj-1', impactAmount: 5000, summary: '重要' },
        ],
        standardReferences: [
          {
            reference: {
              id: 'sr-1',
              standard: 'IFRS',
              referenceType: 'IFRS_standard',
              referenceNumber: 'IFRS 16',
              title: 'リース',
              isActive: true,
            },
            usageCount: 7,
          },
        ],
      }
      expect(report.summary.pendingReview).toBe(20)
      expect(report.byEntityType.mapping).toBe(30)
      expect(report.byRationaleType.presentation_change).toBe(3)
      expect(report.unreviewedItems).toHaveLength(1)
      expect(report.significantImpacts[0].impactAmount).toBe(5000)
      expectTypeOf<AuditReport['byEntityType']>().toEqualTypeOf<Record<EntityType, number>>()
      expectTypeOf<AuditReport['byRationaleType']>().toEqualTypeOf<Record<RationaleType, number>>()
    })
  })

  describe('AuditReportSummary, UnreviewedItem, SignificantImpact', () => {
    it('should construct a summary', () => {
      const summary: AuditReportSummary = {
        totalRationales: 10,
        reviewedRationales: 5,
        aiGeneratedRationales: 4,
        pendingReview: 5,
      }
      expect(summary.totalRationales).toBe(summary.reviewedRationales + summary.pendingReview)
    })

    it('should accept zeroed summary', () => {
      const empty: AuditReportSummary = {
        totalRationales: 0,
        reviewedRationales: 0,
        aiGeneratedRationales: 0,
        pendingReview: 0,
      }
      expect(Object.values(empty).every((v) => v === 0)).toBe(true)
    })

    it('should construct an unreviewed item', () => {
      const item: UnreviewedItem = {
        entityType: 'journal_conversion',
        entityId: 'jc-1',
        summary: '要確認',
        createdAt: CREATED,
      }
      expect(item.entityType).toBe('journal_conversion')
    })

    it('should construct a significant impact', () => {
      const impact: SignificantImpact = {
        entityType: 'fs_conversion',
        entityId: 'fs-1',
        impactAmount: -2500,
        summary: '減少要因',
      }
      expect(impact.impactAmount).toBeLessThan(0)
    })
  })

  describe('GeneratedRationale', () => {
    it('should construct an AI-generated rationale payload', () => {
      const generated: GeneratedRationale = {
        summary: '生成された根拠',
        summaryEn: 'Generated basis',
        detailedExplanation: '詳細',
        detailedExplanationEn: 'Detail',
        sourceReferenceNumbers: ['ASBJ 9'],
        targetReferenceNumbers: ['IFRS 18'],
        impactAmount: 300,
        impactDirection: 'increase',
        confidence: 0.82,
      }
      expect(generated.confidence).toBeLessThanOrEqual(1)
      expect(generated.targetReferenceNumbers).toEqual(['IFRS 18'])
    })

    it('should allow impact fields to be omitted', () => {
      const minimal: GeneratedRationale = {
        summary: '要約',
        summaryEn: 'Summary',
        detailedExplanation: '詳細',
        detailedExplanationEn: 'Detail',
        sourceReferenceNumbers: [],
        targetReferenceNumbers: [],
        confidence: 0,
      }
      expect(minimal.impactAmount).toBeUndefined()
      expect(minimal.impactDirection).toBeUndefined()
      expectTypeOf<GeneratedRationale['confidence']>().toEqualTypeOf<number>()
    })
  })
})
