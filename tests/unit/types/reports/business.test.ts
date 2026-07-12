import { describe, it, expect, expectTypeOf } from 'vitest'
import { SIMPLE_REPORT_SECTIONS, KEIDANREN_REPORT_SECTIONS } from '@/types/reports/business'
import type {
  ReportTemplateType,
  BusinessReportStatus,
  BusinessReportData,
  BusinessReportSection,
  KeidanrenBusinessReport,
  CompanyStatusSection,
  BusinessDescription,
  BusinessSegment,
  BusinessPerformance,
  FinancialFigure,
  YearOverYearComparison,
  ProductionOrders,
  ProductionData,
  FinancialSummary,
  BalanceSheetSummary,
  IncomeStatementSummary,
  CashFlowSummary,
  FinancialRatio,
  RiskManagement,
  RiskItem,
  ESGSection,
  ESGItem,
  ESGMetric,
  SharesSection,
  TotalShares,
  ShareholdingStructure,
  ShareholderTypeBreakdown,
  RegionalBreakdown,
  MajorShareholder,
  StockPriceInfo,
  DividendInfo,
  TreasuryShares,
  TreasuryShareTransaction,
  StockOptionsSection,
  StockAcquisitionRight,
  EquityCompensationPlan,
  ExerciseStatus,
  OfficersSection,
  Director,
  Auditor,
  ExecutiveOfficer,
  OfficersCompensation,
  CompensationBreakdown,
  BoardMeetingsInfo,
  AttendanceRecord,
  AuditorSection,
  DateRange,
  AuditOpinion,
  AuditFees,
  AuditorChange,
  InternalControlSection,
  OrganizationalStructure,
  InternalControlReport,
  ComplianceInfo,
  ComplianceViolation,
  ControlPolicySection,
  TakeoverDefenseInfo,
  SubsidiarySection,
  ParentCompanyInfo,
  RelatedPartyTransactionsSection,
  RelatedPartyTransaction,
  ImportantMattersSection,
  SubsequentEvent,
  LitigationMatter,
  IncidentReport,
  SupplementarySchedules,
  AggregatedReportData,
  CompanyInfo,
  FinancialData,
  MonthlyBalanceData,
  BusinessReportShareholderData,
  ShareholderCompositionData,
  OfficerData,
  DirectorData,
  AuditorData,
  BoardMeetingData,
  JournalData,
  JournalEntryData,
  FixedAssetData,
  RelatedPartyData,
  CalculatedMetrics,
  GenerationContext,
  GeneratedSection,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ApprovalStep,
  WorkflowResult,
  ExportOptions,
  ComplianceResult,
  ComplianceCheckItem,
} from '@/types/reports/business'

describe('src/types/reports/business', () => {
  // ---------------------------------------------------------------------------
  // Fixture factories — each return type-annotated, so tsc enforces the shape
  // of every representative object (layer 2: typed assignment). Tests below add
  // the runtime `expect` (layer 1) and `expectTypeOf` (layer 3).
  // ---------------------------------------------------------------------------

  function makeFigure(overrides: Partial<FinancialFigure> = {}): FinancialFigure {
    return {
      currentYear: 1000,
      previousYear: 900,
      change: 100,
      changePercent: 11.11,
      ...overrides,
    }
  }

  function makeBusinessSegment(): BusinessSegment {
    return {
      name: 'Cloud',
      description: 'SaaS platform',
      revenue: 5000,
      percentage: 50,
    }
  }

  function makeYearOverYearComparison(): YearOverYearComparison {
    return {
      item: 'revenue',
      currentValue: 1000,
      previousValue: 900,
      changePercent: 11.11,
      analysis: 'Steady growth',
    }
  }

  function makeBusinessPerformance(): BusinessPerformance {
    return {
      revenue: makeFigure(),
      operatingIncome: makeFigure({ currentYear: 100 }),
      ordinaryIncome: makeFigure({ currentYear: 90 }),
      netIncome: makeFigure({ currentYear: 60 }),
      yearOverYear: [makeYearOverYearComparison()],
      analysis: 'Year over year improved',
    }
  }

  function makeProductionData(): ProductionData {
    return { period: '2024-Q1', volume: 1200, unit: 'unit' }
  }

  function makeProductionOrders(): ProductionOrders {
    return {
      productionVolume: [makeProductionData()],
      orderStatus: 'Favorable',
    }
  }

  function makeFinancialRatio(): FinancialRatio {
    return { name: 'Current Ratio', currentValue: 1.5, previousValue: 1.3, unit: 'ratio' }
  }

  function makeBalanceSheetSummary(): BalanceSheetSummary {
    return {
      totalAssets: makeFigure({ currentYear: 10000 }),
      currentAssets: makeFigure({ currentYear: 4000 }),
      fixedAssets: makeFigure({ currentYear: 6000 }),
      currentLiabilities: makeFigure({ currentYear: 2000 }),
      fixedLiabilities: makeFigure({ currentYear: 3000 }),
      netAssets: makeFigure({ currentYear: 5000 }),
      totalLiabilitiesAndNetAssets: makeFigure({ currentYear: 10000 }),
    }
  }

  function makeIncomeStatementSummary(): IncomeStatementSummary {
    const f = (n: number): FinancialFigure => makeFigure({ currentYear: n })
    return {
      revenue: f(1000),
      costOfSales: f(600),
      grossProfit: f(400),
      sellingGeneralAdminExpenses: f(200),
      operatingIncome: f(100),
      nonOperatingIncome: f(10),
      nonOperatingExpenses: f(20),
      ordinaryIncome: f(90),
      extraordinaryIncome: f(5),
      extraordinaryLoss: f(15),
      incomeBeforeTax: f(80),
      corporateTax: f(20),
      netIncome: f(60),
    }
  }

  function makeCashFlowSummary(): CashFlowSummary {
    const f = (n: number): FinancialFigure => makeFigure({ currentYear: n })
    return {
      operatingActivities: f(150),
      investingActivities: f(-80),
      financingActivities: f(-40),
      freeCashFlow: f(70),
      cashEquivalentEnd: f(500),
    }
  }

  function makeFinancialSummary(): FinancialSummary {
    return {
      balanceSheet: makeBalanceSheetSummary(),
      incomeStatement: makeIncomeStatementSummary(),
      cashFlowStatement: makeCashFlowSummary(),
      keyRatios: [makeFinancialRatio()],
    }
  }

  function makeRiskItem(): RiskItem {
    return {
      category: 'market',
      description: 'FX fluctuation',
      probability: 'medium',
      impact: 'high',
      mitigation: 'Forward contracts',
    }
  }

  function makeRiskManagement(): RiskManagement {
    return { framework: 'ERM', majorRisks: [makeRiskItem()], bcp: 'BCP plan in place' }
  }

  function makeESGMetric(): ESGMetric {
    return { name: 'CO2', value: 1200, unit: 't-CO2', year: 2024 }
  }

  function makeESGItem(): ESGItem {
    return { initiatives: 'Solar panels', metrics: [makeESGMetric()], targets: 'Net zero by 2050' }
  }

  function makeESGSection(): ESGSection {
    return {
      environmental: makeESGItem(),
      social: makeESGItem(),
      governance: makeESGItem(),
    }
  }

  function makeBusinessDescription(): BusinessDescription {
    return {
      mainBusiness: 'Software',
      businessSegments: [makeBusinessSegment()],
      recentChanges: 'Entered new market',
    }
  }

  function makeCompanyStatusSection(): CompanyStatusSection {
    return {
      businessDescription: makeBusinessDescription(),
      businessPerformance: makeBusinessPerformance(),
      financialSummary: makeFinancialSummary(),
      riskManagement: makeRiskManagement(),
    }
  }

  function makeShareholderTypeBreakdown(): ShareholderTypeBreakdown {
    return { type: 'financial_institution', numberOfShares: 1000, percentage: 30 }
  }

  function makeRegionalBreakdown(): RegionalBreakdown {
    return { region: 'Kanto', numberOfShares: 800, percentage: 24 }
  }

  function makeShareholdingStructure(): ShareholdingStructure {
    return {
      byType: [makeShareholderTypeBreakdown()],
      concentration: 0.3,
    }
  }

  function makeTotalShares(): TotalShares {
    return { authorized: 10000, issued: 5000, treasury: 500, outstanding: 4500 }
  }

  function makeMajorShareholder(): MajorShareholder {
    return {
      rank: 1,
      name: 'ABC Bank',
      numberOfShares: 1000,
      percentage: 30,
      type: 'financial_institution',
    }
  }

  function makeDividendInfo(): DividendInfo {
    return {
      dividendPerShare: 50,
      dividendYield: 0.02,
      payoutRatio: 0.3,
      dividendPolicy: 'Stable dividend',
    }
  }

  function makeStockPriceInfo(): StockPriceInfo {
    return {
      high52Week: 3000,
      low52Week: 2000,
      yearEnd: 2500,
      dividend: makeDividendInfo(),
    }
  }

  function makeTreasuryShareTransaction(
    overrides: Partial<TreasuryShareTransaction> = {}
  ): TreasuryShareTransaction {
    return {
      date: new Date('2024-03-31'),
      numberOfShares: 10,
      purpose: 'Market purchase',
      ...overrides,
    }
  }

  function makeTreasuryShares(): TreasuryShares {
    return {
      beginningBalance: 100,
      acquisitions: [makeTreasuryShareTransaction()],
      dispositions: [makeTreasuryShareTransaction({ purpose: 'Disposition' })],
      endingBalance: 100,
    }
  }

  function makeSharesSection(): SharesSection {
    return {
      totalShares: makeTotalShares(),
      shareholdingStructure: makeShareholdingStructure(),
      majorShareholders: [makeMajorShareholder()],
    }
  }

  function makeStockAcquisitionRight(): StockAcquisitionRight {
    return {
      type: 'stock_option',
      grantDate: new Date('2024-04-01'),
      beneficiaries: 10,
      numberOfShares: 1000,
      exercisePrice: 2500,
      exercisePeriodStart: new Date('2025-04-01'),
      exercisePeriodEnd: new Date('2030-03-31'),
    }
  }

  function makeEquityCompensationPlan(): EquityCompensationPlan {
    return {
      planName: 'RSU Plan',
      planType: 'rsu',
      eligibleParticipants: 'Employees',
      totalSharesReserved: 5000,
      grantedShares: 1000,
      vestingConditions: '4 year cliff',
    }
  }

  function makeExerciseStatus(): ExerciseStatus {
    return {
      fiscalYear: 2024,
      exercisedRights: 5,
      exercisedShares: 500,
      exerciseAmount: 1250000,
    }
  }

  function makeStockOptionsSection(): StockOptionsSection {
    return {
      stockAcquisitionRights: [makeStockAcquisitionRight()],
      exerciseStatus: [makeExerciseStatus()],
    }
  }

  function makeCompensationBreakdown(): CompensationBreakdown {
    return {
      baseCompensation: 100,
      bonus: 20,
      stockCompensation: 10,
      retirementAllowance: 5,
      total: 135,
      numberOfPersons: 3,
    }
  }

  function makeDirector(): Director {
    return {
      id: 'd1',
      name: 'Taro Yamada',
      position: 'president',
      termStart: new Date('2023-06-01'),
      termEnd: new Date('2025-05-31'),
      attendance: 0.95,
      background: '20y finance',
      independent: false,
    }
  }

  function makeAuditor(): Auditor {
    return {
      id: 'a1',
      name: 'Hanako Suzuki',
      position: 'standing',
      termStart: new Date('2023-06-01'),
      termEnd: new Date('2025-05-31'),
      attendance: 1,
      background: 'CPA',
      independent: true,
    }
  }

  function makeExecutiveOfficer(): ExecutiveOfficer {
    return {
      id: 'e1',
      name: 'Ichiro Sato',
      title: 'CFO',
      responsibilities: 'Finance',
      appointedDate: new Date('2023-06-01'),
    }
  }

  function makeOfficersCompensation(): OfficersCompensation {
    return {
      directors: makeCompensationBreakdown(),
      auditors: makeCompensationBreakdown(),
      total: 270,
      policy: 'Performance linked',
    }
  }

  function makeAttendanceRecord(): AttendanceRecord {
    return {
      name: 'Taro Yamada',
      position: 'president',
      meetingsHeld: 12,
      meetingsAttended: 12,
      attendanceRate: 1,
    }
  }

  function makeBoardMeetingsInfo(): BoardMeetingsInfo {
    return { heldCount: 12, attendance: [makeAttendanceRecord()] }
  }

  function makeOfficersSection(): OfficersSection {
    return {
      directors: [makeDirector()],
      auditors: [makeAuditor()],
      compensation: makeOfficersCompensation(),
      boardMeetings: makeBoardMeetingsInfo(),
    }
  }

  function makeDateRange(): DateRange {
    return { start: new Date('2023-06-01'), end: new Date('2025-05-31') }
  }

  function makeAuditOpinion(): AuditOpinion {
    return { type: 'unqualified', summary: 'Fair presentation', reportDate: new Date('2024-06-01') }
  }

  function makeAuditFees(): AuditFees {
    return { auditFee: 30, nonAuditFee: 5, total: 35 }
  }

  function makeAuditorChange(): AuditorChange {
    return {
      date: new Date('2023-06-01'),
      previousAuditor: 'Old Firm',
      newAuditor: 'New Firm',
      reason: 'Rotation',
    }
  }

  function makeAuditorSection(): AuditorSection {
    return {
      name: 'New Firm',
      firm: 'New Firm LLC',
      engagementPeriod: makeDateRange(),
      auditOpinion: makeAuditOpinion(),
      auditFees: makeAuditFees(),
    }
  }

  function makeOrganizationalStructure(): OrganizationalStructure {
    return { boardOfDirectors: '10 directors', auditSystem: '4 auditors' }
  }

  function makeInternalControlReport(): InternalControlReport {
    return {
      assessmentDate: new Date('2024-03-31'),
      conclusion: 'effective',
      materialWeaknesses: [],
      significantDeficiencies: [],
    }
  }

  function makeComplianceViolation(): ComplianceViolation {
    return {
      date: new Date('2024-01-15'),
      description: 'Minor breach',
      correctiveAction: 'Training held',
    }
  }

  function makeComplianceInfo(): ComplianceInfo {
    return { policy: 'Code of conduct', training: 'Annual', whistleblowing: 'Hotline' }
  }

  function makeInternalControlSection(): InternalControlSection {
    return {
      basicPolicy: 'Basic policy text',
      organizationalStructure: makeOrganizationalStructure(),
      compliance: makeComplianceInfo(),
      riskManagementSystem: 'Risk system',
    }
  }

  function makeTakeoverDefenseInfo(): TakeoverDefenseInfo {
    return { hasMeasures: false, measures: 'None' }
  }

  function makeControlPolicySection(): ControlPolicySection {
    return { hasPolicy: true, capitalPolicy: 'Retain earnings' }
  }

  function makeParentCompanyInfo(): ParentCompanyInfo {
    return {
      name: 'Parent Co',
      address: 'Tokyo',
      relationship: 'Parent',
      ownershipPercentage: 0.51,
    }
  }

  function makeSubsidiarySection(): SubsidiarySection {
    return { isWhollyOwnedSubsidiary: false }
  }

  function makeRelatedPartyTransaction(): RelatedPartyTransaction {
    return {
      partyName: 'Parent Co',
      relationship: 'Parent',
      transactionType: 'Loan',
      amount: 1000,
      terms: 'Interest 1%',
    }
  }

  function makeRelatedPartyTransactionsSection(): RelatedPartyTransactionsSection {
    return {
      hasTransactions: true,
      transactions: [makeRelatedPartyTransaction()],
      summary: 'Arm length',
      armLengthConfirmation: 'Confirmed',
    }
  }

  function makeSubsequentEvent(): SubsequentEvent {
    return { date: new Date('2024-04-10'), description: 'Acquisition', impact: 'material' }
  }

  function makeLitigationMatter(): LitigationMatter {
    return {
      caseName: 'v. X',
      plaintiffDefendant: 'Co v. X',
      filingDate: new Date('2024-02-01'),
      currentStatus: 'Pending',
      potentialImpact: 'Unknown',
    }
  }

  function makeIncidentReport(): IncidentReport {
    return {
      date: new Date('2024-03-01'),
      type: 'cyber_incident',
      description: 'Phishing',
      damage: 'None',
      responseMeasures: 'Reset passwords',
    }
  }

  function makeImportantMattersSection(): ImportantMattersSection {
    return {}
  }

  function makeSupplementarySchedules(): SupplementarySchedules {
    return {}
  }

  function makeKeidanrenBusinessReport(): KeidanrenBusinessReport {
    return {
      id: 'r1',
      companyId: 'c1',
      companyName: 'Test Co',
      fiscalYear: 2024,
      version: 1,
      status: 'draft',
      createdAt: new Date('2024-04-01'),
      updatedAt: new Date('2024-04-02'),
      templateVersion: '1.0',
      templateType: 'keidanren_standard',
      companyStatus: makeCompanyStatusSection(),
      shares: makeSharesSection(),
      stockOptions: makeStockOptionsSection(),
      officers: makeOfficersSection(),
      auditor: makeAuditorSection(),
      internalControl: makeInternalControlSection(),
      controlPolicy: makeControlPolicySection(),
      subsidiary: makeSubsidiarySection(),
      relatedPartyTransactions: makeRelatedPartyTransactionsSection(),
      importantMatters: makeImportantMattersSection(),
    }
  }

  function makeBusinessReportData(): BusinessReportData {
    return {
      fiscalYear: 2024,
      companyName: 'Test Co',
      businessOverview: 'overview',
      businessEnvironment: 'environment',
      managementPolicy: 'policy',
      issuesAndRisks: 'risks',
      financialHighlights: 'highlights',
      researchAndDevelopment: 'rnd',
      corporateGovernance: 'governance',
    }
  }

  function makeCompanyInfo(): CompanyInfo {
    return { id: 'c1', name: 'Test Co', fiscalYearStart: 2024 }
  }

  function makeMonthlyBalanceData(): MonthlyBalanceData {
    return { month: 3, fiscalYear: 2024, category: 'assets', accountName: 'Cash', amount: 1000 }
  }

  function makeFinancialData(): FinancialData {
    return {
      monthlyBalances: [makeMonthlyBalanceData()],
      currentYearTotals: { revenue: 1000 },
      previousYearTotals: { revenue: 900 },
    }
  }

  function makeShareholderCompositionData(): ShareholderCompositionData {
    return { type: 'individual', numberOfShares: 1000, percentage: 30 }
  }

  function makeBusinessReportShareholderData(): BusinessReportShareholderData {
    return { totalShares: 4500, shareholderComposition: [makeShareholderCompositionData()] }
  }

  function makeDirectorData(): DirectorData {
    return { id: 'd1', name: 'Taro', position: 'president' }
  }

  function makeAuditorData(): AuditorData {
    return { id: 'a1', name: 'Hanako', position: 'standing' }
  }

  function makeOfficerData(): OfficerData {
    return { directors: [makeDirectorData()], auditors: [makeAuditorData()] }
  }

  function makeBoardMeetingData(): BoardMeetingData {
    return {
      id: 'm1',
      date: new Date('2024-03-01'),
      title: 'Q1 meeting',
      attendees: ['Taro'],
    }
  }

  function makeJournalEntryData(): JournalEntryData {
    return {
      id: 'j1',
      entryDate: new Date('2024-03-01'),
      description: 'Sale',
      debitAccount: 'Cash',
      creditAccount: 'Revenue',
      amount: 1000,
    }
  }

  function makeJournalData(): JournalData {
    return { entries: [makeJournalEntryData()], totals: { Revenue: 1000 } }
  }

  function makeFixedAssetData(): FixedAssetData {
    return {
      id: 'f1',
      name: 'Server',
      acquisitionCost: 1000,
      accumulatedDep: 400,
      bookValue: 600,
      usefulLife: 5,
    }
  }

  function makeRelatedPartyData(): RelatedPartyData {
    return { name: 'Parent Co', relationship: 'Parent' }
  }

  function makeCalculatedMetrics(): CalculatedMetrics {
    return {
      revenueGrowth: 0.1,
      operatingMargin: 0.1,
      netMargin: 0.06,
      roe: 0.12,
      roa: 0.06,
      currentRatio: 2,
      debtToEquity: 1,
    }
  }

  function makeAggregatedReportData(): AggregatedReportData {
    return {
      companyInfo: makeCompanyInfo(),
      financialData: makeFinancialData(),
      shareholders: makeBusinessReportShareholderData(),
      officers: makeOfficerData(),
      boardMeetings: [makeBoardMeetingData()],
      journals: makeJournalData(),
      fixedAssets: [makeFixedAssetData()],
      relatedParties: [makeRelatedPartyData()],
      calculatedMetrics: makeCalculatedMetrics(),
    }
  }

  function makeGenerationContext(): GenerationContext {
    return { sectionType: 'businessOverview', companyName: 'Test Co', fiscalYear: 2024 }
  }

  function makeGeneratedSection(): GeneratedSection {
    return { content: 'content', sources: ['src'], confidence: 0.9, warnings: [] }
  }

  function makeValidationError(): ValidationError {
    return { field: 'fiscalYear', message: 'required', code: 'REQUIRED' }
  }

  function makeValidationWarning(): ValidationWarning {
    return { field: 'notes', message: 'too short' }
  }

  function makeValidationResult(isValid = true): ValidationResult {
    return { isValid, errors: [], warnings: [] }
  }

  function makeApprovalStep(): ApprovalStep {
    return { role: 'accountant', action: 'review', required: true }
  }

  function makeWorkflowResult(): WorkflowResult {
    return { success: true, message: 'ok' }
  }

  function makeExportOptions(): ExportOptions {
    return {
      format: 'pdf',
      includeSupplementarySchedules: true,
      language: 'ja',
      pageSize: 'A4',
      orientation: 'portrait',
    }
  }

  function makeComplianceCheckItem(): ComplianceCheckItem {
    return { requirement: 'Audit', legalBasis: 'Companies Act', status: 'pass' }
  }

  function makeComplianceResult(): ComplianceResult {
    return { isCompliant: true, checkedItems: [makeComplianceCheckItem()], missingRequirements: [] }
  }

  // ---------------------------------------------------------------------------
  // Module resolution
  // ---------------------------------------------------------------------------

  it('module resolves with the two runtime constants', async () => {
    const mod = await import('@/types/reports/business')
    expect(mod.SIMPLE_REPORT_SECTIONS).toBeDefined()
    expect(mod.KEIDANREN_REPORT_SECTIONS).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Exported type-alias unions
  // ---------------------------------------------------------------------------

  describe('ReportTemplateType', () => {
    it('contains exactly the two template literals', () => {
      const values: ReportTemplateType[] = ['simple', 'keidanren']
      expect(values).toHaveLength(2)
      expect(new Set(values).size).toBe(2)
      expect(values).toContain('simple')
      expect(values).toContain('keidanren')
      expectTypeOf(values[0]).toEqualTypeOf<ReportTemplateType>()
    })
  })

  describe('BusinessReportStatus', () => {
    it('contains exactly the four workflow statuses', () => {
      const values: BusinessReportStatus[] = ['draft', 'under_review', 'approved', 'finalized']
      expect(values).toHaveLength(4)
      expect(new Set(values).size).toBe(4)
      expect(values).toEqual(['draft', 'under_review', 'approved', 'finalized'])
    })
  })

  // ---------------------------------------------------------------------------
  // Runtime constant: SIMPLE_REPORT_SECTIONS
  // ---------------------------------------------------------------------------

  describe('SIMPLE_REPORT_SECTIONS', () => {
    it('has exactly 7 sections', () => {
      expect(SIMPLE_REPORT_SECTIONS).toHaveLength(7)
    })

    it('is assignable to BusinessReportSection[]', () => {
      const sections: BusinessReportSection[] = SIMPLE_REPORT_SECTIONS
      expect(sections).toBe(SIMPLE_REPORT_SECTIONS)
    })

    it('keys are unique and match the report-data fields exactly', () => {
      const keys = SIMPLE_REPORT_SECTIONS.map((s) => s.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(keys).toEqual([
        'businessOverview',
        'businessEnvironment',
        'managementPolicy',
        'issuesAndRisks',
        'financialHighlights',
        'researchAndDevelopment',
        'corporateGovernance',
      ])
    })

    it('excludes fiscalYear and companyName', () => {
      const keys = SIMPLE_REPORT_SECTIONS.map((s) => s.key)
      expect(keys).not.toContain('fiscalYear')
      expect(keys).not.toContain('companyName')
    })

    it('every section has a valid key referencing an Omit field of BusinessReportData', () => {
      const allowed: Array<keyof Omit<BusinessReportData, 'fiscalYear' | 'companyName'>> = [
        'businessOverview',
        'businessEnvironment',
        'managementPolicy',
        'issuesAndRisks',
        'financialHighlights',
        'researchAndDevelopment',
        'corporateGovernance',
      ]
      for (const s of SIMPLE_REPORT_SECTIONS) {
        expect(allowed).toContain(s.key)
      }
    })

    it('every section has non-empty title and description', () => {
      for (const s of SIMPLE_REPORT_SECTIONS) {
        expect(typeof s.title).toBe('string')
        expect(s.title.length).toBeGreaterThan(0)
        expect(typeof s.description).toBe('string')
        expect(s.description.length).toBeGreaterThan(0)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Runtime constant: KEIDANREN_REPORT_SECTIONS
  // ---------------------------------------------------------------------------

  describe('KEIDANREN_REPORT_SECTIONS', () => {
    it('has exactly 10 top-level sections', () => {
      expect(KEIDANREN_REPORT_SECTIONS).toHaveLength(10)
    })

    it('is declared as const (readonly tuple)', () => {
      expectTypeOf(KEIDANREN_REPORT_SECTIONS).toMatchTypeOf<readonly unknown[]>()
    })

    it('section ids are unique', () => {
      const ids = KEIDANREN_REPORT_SECTIONS.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('first section is companyStatus and last is importantMatters', () => {
      expect(KEIDANREN_REPORT_SECTIONS[0].id).toBe('companyStatus')
      expect(KEIDANREN_REPORT_SECTIONS[KEIDANREN_REPORT_SECTIONS.length - 1].id).toBe(
        'importantMatters'
      )
    })

    it('every section has a non-empty title and a non-empty subSections array', () => {
      for (const s of KEIDANREN_REPORT_SECTIONS) {
        expect(typeof s.id).toBe('string')
        expect(s.id.length).toBeGreaterThan(0)
        expect(typeof s.title).toBe('string')
        expect(s.title.length).toBeGreaterThan(0)
        expect(Array.isArray(s.subSections)).toBe(true)
        expect(s.subSections.length).toBeGreaterThan(0)
      }
    })

    it('every subSection has non-empty id and title', () => {
      for (const s of KEIDANREN_REPORT_SECTIONS) {
        for (const ss of s.subSections) {
          expect(typeof ss.id).toBe('string')
          expect(ss.id.length).toBeGreaterThan(0)
          expect(typeof ss.title).toBe('string')
          expect(ss.title.length).toBeGreaterThan(0)
        }
      }
    })

    it('subSection ids are unique within each section', () => {
      for (const s of KEIDANREN_REPORT_SECTIONS) {
        const ids = s.subSections.map((ss) => ss.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    })

    it('references the ids referenced by KeidanrenBusinessReport section keys', () => {
      const ids = KEIDANREN_REPORT_SECTIONS.map((s) => s.id)
      const expected = [
        'companyStatus',
        'shares',
        'stockOptions',
        'officers',
        'auditor',
        'internalControl',
        'controlPolicy',
        'subsidiary',
        'relatedPartyTransactions',
        'importantMatters',
      ]
      expect(ids).toEqual(expected)
    })
  })

  // ---------------------------------------------------------------------------
  // Core report interfaces
  // ---------------------------------------------------------------------------

  describe('BusinessReportData', () => {
    it('carries fiscalYear and all seven free-text sections', () => {
      const data = makeBusinessReportData()
      const check: BusinessReportData = data
      expect(check.fiscalYear).toBe(2024)
      expect(check.companyName).toBe('Test Co')
      expect(check.businessOverview).toBe('overview')
      expect(Object.keys(check).sort()).toEqual([
        'businessEnvironment',
        'businessOverview',
        'companyName',
        'corporateGovernance',
        'financialHighlights',
        'fiscalYear',
        'issuesAndRisks',
        'managementPolicy',
        'researchAndDevelopment',
      ])
    })
  })

  describe('BusinessReportSection', () => {
    it('binds key to the Omit keys and carries title/description', () => {
      const section: BusinessReportSection = {
        key: 'financialHighlights',
        title: '5. 財務ハイライト',
        description: 'desc',
      }
      expect(section.key).toBe('financialHighlights')
      expect(section.title).toContain('財務')
      expectTypeOf(section.key).toEqualTypeOf<
        keyof Omit<BusinessReportData, 'fiscalYear' | 'companyName'>
      >()
    })
  })

  describe('KeidanrenBusinessReport', () => {
    it('composes every required section and exposes header metadata', () => {
      const report = makeKeidanrenBusinessReport()
      const check: KeidanrenBusinessReport = report
      expect(check.id).toBe('r1')
      expect(check.companyId).toBe('c1')
      expect(check.version).toBe(1)
      expect(check.status).toBe('draft')
      expect(check.templateType).toBe('keidanren_standard')
      expect(check.companyStatus.businessPerformance.revenue.currentYear).toBe(1000)
      expect(check.shares.totalShares.outstanding).toBe(4500)
      expect(check.officers.directors[0].position).toBe('president')
      expect(check.auditor.auditOpinion.type).toBe('unqualified')
      expect(check.importantMatters).toEqual({})
    })

    it('optional approval and supplementary fields are truly optional', () => {
      const report = makeKeidanrenBusinessReport()
      expect(report.approvedBy).toBeUndefined()
      expect(report.approvedAt).toBeUndefined()
      expect(report.supplementarySchedules).toBeUndefined()
      expectTypeOf<KeidanrenBusinessReport['approvedBy']>().toEqualTypeOf<string | undefined>()
    })
  })

  // ---------------------------------------------------------------------------
  // Company status group
  // ---------------------------------------------------------------------------

  describe('CompanyStatusSection and children', () => {
    it('CompanyStatusSection holds required sub-sections, omits optionals', () => {
      const section = makeCompanyStatusSection()
      const check: CompanyStatusSection = section
      expect(check.businessDescription.mainBusiness).toBe('Software')
      expect(check.businessPerformance.revenue.changePercent).toBe(11.11)
      expect(check.financialSummary.keyRatios[0].unit).toBe('ratio')
      expect(check.riskManagement.majorRisks[0].impact).toBe('high')
      expect(check.productionOrders).toBeUndefined()
      expect(check.esg).toBeUndefined()
    })

    it('BusinessSegment carries revenue and percentage', () => {
      const seg: BusinessSegment = makeBusinessSegment()
      expect(seg.percentage).toBe(50)
      expect(seg.name).toBe('Cloud')
    })

    it('FinancialFigure carries the four numeric fields', () => {
      const fig: FinancialFigure = makeFigure()
      expect(Object.keys(fig).sort()).toEqual([
        'change',
        'changePercent',
        'currentYear',
        'previousYear',
      ])
    })

    it('YearOverYearComparison carries item, values, change and analysis', () => {
      const yoy: YearOverYearComparison = makeYearOverYearComparison()
      expect(yoy.changePercent).toBe(11.11)
      expect(yoy.analysis).toBe('Steady growth')
    })

    it('BusinessPerformance exposes four figures + YoY array + analysis', () => {
      const perf: BusinessPerformance = makeBusinessPerformance()
      expect(perf.yearOverYear).toHaveLength(1)
      expect(perf.operatingIncome.currentYear).toBe(100)
    })

    it('ProductionData and ProductionOrders (capacity optional)', () => {
      const po: ProductionOrders = makeProductionOrders()
      const pd: ProductionData = makeProductionData()
      expect(po.productionVolume[0]).toEqual(pd)
      expect(po.capacityUtilization).toBeUndefined()
    })

    it('FinancialSummary composes BS/PL/CF + keyRatios', () => {
      const fs: FinancialSummary = makeFinancialSummary()
      expect(fs.incomeStatement.netIncome.currentYear).toBe(60)
      expect(fs.cashFlowStatement.freeCashFlow.currentYear).toBe(70)
      expect(fs.balanceSheet.totalAssets.currentYear).toBe(10000)
      expect(fs.keyRatios).toHaveLength(1)
    })

    it('FinancialRatio unit union covers all four members', () => {
      const units: FinancialRatio['unit'][] = ['percent', 'ratio', 'times', 'days']
      expect(units).toHaveLength(4)
      expect(new Set(units).size).toBe(4)
    })

    it('RiskItem probability/impact unions cover high/medium/low', () => {
      const levels: RiskItem['impact'][] = ['high', 'medium', 'low']
      expect(levels).toHaveLength(3)
      expect(new Set(levels).size).toBe(3)
    })

    it('RiskManagement holds framework, risks and BCP', () => {
      const rm: RiskManagement = makeRiskManagement()
      expect(rm.bcp).toBe('BCP plan in place')
      expect(rm.majorRisks[0].category).toBe('market')
    })

    it('ESG group: ESGMetric/ESGItem/ESGSection', () => {
      const esg: ESGSection = makeESGSection()
      const item: ESGItem = makeESGItem()
      const metric: ESGMetric = makeESGMetric()
      expect(esg.environmental).toEqual(item)
      expect(metric.unit).toBe('t-CO2')
      expect(item.metrics[0]).toEqual(metric)
    })
  })

  // ---------------------------------------------------------------------------
  // Shares group
  // ---------------------------------------------------------------------------

  describe('SharesSection and children', () => {
    it('SharesSection composes totals, structure and major shareholders', () => {
      const shares: SharesSection = makeSharesSection()
      expect(shares.totalShares.outstanding).toBe(4500)
      expect(shares.majorShareholders[0].rank).toBe(1)
      expect(shares.stockPrice).toBeUndefined()
      expect(shares.treasuryShares).toBeUndefined()
    })

    it('TotalShares authorized >= issued and issued minus treasury equals outstanding', () => {
      const ts: TotalShares = makeTotalShares()
      expect(ts.authorized).toBeGreaterThanOrEqual(ts.issued)
      expect(ts.issued - ts.treasury).toBe(ts.outstanding)
    })

    it('ShareholdingStructure byType required, byRegion optional', () => {
      const sh: ShareholdingStructure = makeShareholdingStructure()
      expect(sh.concentration).toBe(0.3)
      expect(sh.byRegion).toBeUndefined()
      const rb: RegionalBreakdown = makeRegionalBreakdown()
      expect(rb.region).toBe('Kanto')
    })

    it('ShareholderTypeBreakdown covers all six type members', () => {
      const types: ShareholderTypeBreakdown['type'][] = [
        'financial_institution',
        'corporation',
        'individual',
        'foreign_investor',
        'treasury',
        'other',
      ]
      expect(types).toHaveLength(6)
      expect(new Set(types).size).toBe(6)
    })

    it('MajorShareholder type union covers five members', () => {
      const types: MajorShareholder['type'][] = [
        'financial_institution',
        'corporation',
        'individual',
        'foreign_investor',
        'other',
      ]
      expect(types).toHaveLength(5)
      expect(new Set(types).size).toBe(5)
    })

    it('StockPriceInfo + DividendInfo (tradingVolume optional)', () => {
      const sp: StockPriceInfo = makeStockPriceInfo()
      const div: DividendInfo = makeDividendInfo()
      expect(sp.high52Week).toBe(3000)
      expect(sp.tradingVolume).toBeUndefined()
      expect(div.payoutRatio).toBe(0.3)
    })

    it('TreasuryShares + TreasuryShareTransaction (pricePerShare optional)', () => {
      const tr: TreasuryShares = makeTreasuryShares()
      const tx: TreasuryShareTransaction = makeTreasuryShareTransaction()
      expect(tr.endingBalance).toBe(100)
      expect(tx.date).toBeInstanceOf(Date)
      expect(tx.pricePerShare).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Stock options group
  // ---------------------------------------------------------------------------

  describe('StockOptionsSection and children', () => {
    it('StockOptionsSection composes rights and exercise status', () => {
      const so: StockOptionsSection = makeStockOptionsSection()
      expect(so.stockAcquisitionRights).toHaveLength(1)
      expect(so.exerciseStatus).toHaveLength(1)
      expect(so.equityCompensation).toBeUndefined()
    })

    it('StockAcquisitionRight carries dates and exercise window', () => {
      const right: StockAcquisitionRight = makeStockAcquisitionRight()
      expect(right.beneficiaries).toBe(10)
      expect(right.exercisePrice).toBe(2500)
      expect(right.grantDate).toBeInstanceOf(Date)
      expect(right.vestingSchedule).toBeUndefined()
    })

    it('EquityCompensationPlan planType union covers four members', () => {
      const plans: EquityCompensationPlan['planType'][] = [
        'rsu',
        'stock_option',
        'restricted_stock',
        'performance_share',
      ]
      expect(plans).toHaveLength(4)
      expect(new Set(plans).size).toBe(4)
      const plan: EquityCompensationPlan = makeEquityCompensationPlan()
      expect(plan.planType).toBe('rsu')
      expect(plan.grantedShares).toBe(1000)
    })

    it('ExerciseStatus aggregates a single fiscal year of activity', () => {
      const st: ExerciseStatus = makeExerciseStatus()
      expect(st.exercisedShares).toBe(500)
    })
  })

  // ---------------------------------------------------------------------------
  // Officers group
  // ---------------------------------------------------------------------------

  describe('OfficersSection and children', () => {
    it('OfficersSection composes directors, auditors, compensation, board meetings', () => {
      const officers: OfficersSection = makeOfficersSection()
      expect(officers.directors).toHaveLength(1)
      expect(officers.auditors).toHaveLength(1)
      expect(officers.compensation.total).toBe(270)
      expect(officers.executiveOfficers).toBeUndefined()
    })

    it('Director.position covers all six roles', () => {
      const positions: Director['position'][] = [
        'chairman',
        'president',
        'vice_president',
        'director',
        'managing_director',
        'senior_managing_director',
      ]
      expect(positions).toHaveLength(6)
      expect(new Set(positions).size).toBe(6)
    })

    it('Director optional otherPositions/committees', () => {
      const d: Director = makeDirector()
      expect(d.independent).toBe(false)
      expect(d.otherPositions).toBeUndefined()
      expect(d.committees).toBeUndefined()
    })

    it('Auditor.position covers full_time/part_time/standing', () => {
      const positions: Auditor['position'][] = ['full_time', 'part_time', 'standing']
      expect(positions).toHaveLength(3)
    })

    it('ExecutiveOfficer carries appointment date', () => {
      const eo: ExecutiveOfficer = makeExecutiveOfficer()
      expect(eo.title).toBe('CFO')
      expect(eo.appointedDate).toBeInstanceOf(Date)
    })

    it('OfficersCompensation + CompensationBreakdown (executiveOfficers optional)', () => {
      const oc: OfficersCompensation = makeOfficersCompensation()
      const cb: CompensationBreakdown = makeCompensationBreakdown()
      expect(oc.executiveOfficers).toBeUndefined()
      expect(cb.total).toBe(135)
      expect(cb.numberOfPersons).toBe(3)
    })

    it('BoardMeetingsInfo + AttendanceRecord', () => {
      const bm: BoardMeetingsInfo = makeBoardMeetingsInfo()
      const rec: AttendanceRecord = makeAttendanceRecord()
      expect(bm.heldCount).toBe(12)
      expect(bm.attendance[0]).toEqual(rec)
    })
  })

  // ---------------------------------------------------------------------------
  // Auditor group
  // ---------------------------------------------------------------------------

  describe('AuditorSection and children', () => {
    it('AuditorSection composes engagement period, opinion and fees (changes optional)', () => {
      const aud: AuditorSection = makeAuditorSection()
      expect(aud.auditFees.total).toBe(35)
      expect(aud.changes).toBeUndefined()
    })

    it('DateRange is start/end pair', () => {
      const dr: DateRange = makeDateRange()
      expect(dr.start).toBeInstanceOf(Date)
      expect(dr.end).toBeInstanceOf(Date)
    })

    it('AuditOpinion.type covers the four opinions (emphasisOfMatter optional)', () => {
      const types: AuditOpinion['type'][] = ['unqualified', 'qualified', 'adverse', 'disclaimer']
      expect(types).toHaveLength(4)
      expect(new Set(types).size).toBe(4)
      const op: AuditOpinion = makeAuditOpinion()
      expect(op.emphasisOfMatter).toBeUndefined()
    })

    it('AuditFees (nonAuditServices optional)', () => {
      const fees: AuditFees = makeAuditFees()
      expect(fees.auditFee + fees.nonAuditFee).toBe(fees.total)
      expect(fees.nonAuditServices).toBeUndefined()
    })

    it('AuditorChange carries previous/new auditor and reason', () => {
      const ch: AuditorChange = makeAuditorChange()
      expect(ch.reason).toBe('Rotation')
    })
  })

  // ---------------------------------------------------------------------------
  // Internal control group
  // ---------------------------------------------------------------------------

  describe('InternalControlSection and children', () => {
    it('InternalControlSection composes required pieces (report optional)', () => {
      const ic: InternalControlSection = makeInternalControlSection()
      expect(ic.basicPolicy).toBe('Basic policy text')
      expect(ic.internalControlReport).toBeUndefined()
    })

    it('OrganizationalStructure with optional committees', () => {
      const os: OrganizationalStructure = makeOrganizationalStructure()
      expect(os.boardOfDirectors).toBe('10 directors')
      expect(os.nominationCommittee).toBeUndefined()
      expect(os.advisoryCommittees).toBeUndefined()
    })

    it('InternalControlReport conclusion is effective|ineffective', () => {
      const conclusions: InternalControlReport['conclusion'][] = ['effective', 'ineffective']
      expect(conclusions).toHaveLength(2)
      const rep: InternalControlReport = makeInternalControlReport()
      expect(rep.materialWeaknesses).toEqual([])
      expect(rep.remediation).toBeUndefined()
    })

    it('ComplianceInfo + ComplianceViolation (violations optional)', () => {
      const ci: ComplianceInfo = makeComplianceInfo()
      const v: ComplianceViolation = makeComplianceViolation()
      expect(ci.violations).toBeUndefined()
      expect(v.correctiveAction).toBe('Training held')
    })
  })

  // ---------------------------------------------------------------------------
  // Control policy, subsidiary, related party groups
  // ---------------------------------------------------------------------------

  describe('ControlPolicy / Subsidiary / RelatedParty', () => {
    it('ControlPolicySection + TakeoverDefenseInfo optionals', () => {
      const cp: ControlPolicySection = makeControlPolicySection()
      const td: TakeoverDefenseInfo = makeTakeoverDefenseInfo()
      expect(cp.hasPolicy).toBe(true)
      expect(cp.policyContent).toBeUndefined()
      expect(cp.takeoverDefense).toBeUndefined()
      expect(td.adoptionDate).toBeUndefined()
      expect(td.triggerEvents).toBeUndefined()
    })

    it('SubsidiarySection + ParentCompanyInfo (all optional except flag)', () => {
      const sub: SubsidiarySection = makeSubsidiarySection()
      const pc: ParentCompanyInfo = makeParentCompanyInfo()
      expect(sub.isWhollyOwnedSubsidiary).toBe(false)
      expect(sub.parentCompany).toBeUndefined()
      expect(pc.ownershipPercentage).toBe(0.51)
    })

    it('RelatedPartyTransactionsSection + RelatedPartyTransaction (optionals)', () => {
      const rpt: RelatedPartyTransactionsSection = makeRelatedPartyTransactionsSection()
      const tx: RelatedPartyTransaction = makeRelatedPartyTransaction()
      expect(rpt.hasTransactions).toBe(true)
      expect(rpt.transactions).toHaveLength(1)
      expect(tx.outstandingBalance).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Important matters group
  // ---------------------------------------------------------------------------

  describe('ImportantMattersSection and children', () => {
    it('ImportantMattersSection is fully optional (degrades to empty object)', () => {
      const im: ImportantMattersSection = makeImportantMattersSection()
      expect(im).toEqual({})
      expect(im.subsequentEvents).toBeUndefined()
      expect(im.litigation).toBeUndefined()
      expect(im.incidents).toBeUndefined()
      expect(im.otherMatters).toBeUndefined()
    })

    it('SubsequentEvent impact is material|immaterial, amount optional', () => {
      const impacts: SubsequentEvent['impact'][] = ['material', 'immaterial']
      expect(impacts).toHaveLength(2)
      const se: SubsequentEvent = makeSubsequentEvent()
      expect(se.financialEffect).toBeUndefined()
    })

    it('LitigationMatter (claimedAmount optional)', () => {
      const lm: LitigationMatter = makeLitigationMatter()
      expect(lm.currentStatus).toBe('Pending')
      expect(lm.claimedAmount).toBeUndefined()
    })

    it('IncidentReport type covers four kinds (financialImpact optional)', () => {
      const types: IncidentReport['type'][] = ['disaster', 'accident', 'cyber_incident', 'other']
      expect(types).toHaveLength(4)
      expect(new Set(types).size).toBe(4)
      const ir: IncidentReport = makeIncidentReport()
      expect(ir.financialImpact).toBeUndefined()
    })

    it('SupplementarySchedules is fully optional (degrades to empty object)', () => {
      const ss: SupplementarySchedules = makeSupplementarySchedules()
      expect(ss).toEqual({})
    })
  })

  // ---------------------------------------------------------------------------
  // Aggregated report data group
  // ---------------------------------------------------------------------------

  describe('AggregatedReportData and children', () => {
    it('AggregatedReportData composes every input source', () => {
      const agg: AggregatedReportData = makeAggregatedReportData()
      expect(agg.companyInfo.name).toBe('Test Co')
      expect(agg.financialData.currentYearTotals.revenue).toBe(1000)
      expect(agg.shareholders.totalShares).toBe(4500)
      expect(agg.officers.directors[0].name).toBe('Taro')
      expect(agg.boardMeetings).toHaveLength(1)
      expect(agg.journals.totals.Revenue).toBe(1000)
      expect(agg.fixedAssets[0].bookValue).toBe(600)
      expect(agg.relatedParties[0].relationship).toBe('Parent')
      expect(agg.calculatedMetrics.roe).toBe(0.12)
    })

    it('CompanyInfo with optional fields omitted', () => {
      const ci: CompanyInfo = makeCompanyInfo()
      expect(ci.industry).toBeUndefined()
      expect(ci.foundedDate).toBeUndefined()
    })

    it('FinancialData carries monthlyBalances and Record<string,number> totals', () => {
      const fd: FinancialData = makeFinancialData()
      expect(fd.monthlyBalances).toHaveLength(1)
      expect(Object.keys(fd.currentYearTotals)).toEqual(['revenue'])
    })

    it('MonthlyBalanceData flat numeric record', () => {
      const mb: MonthlyBalanceData = makeMonthlyBalanceData()
      expect(mb.amount).toBe(1000)
      expect(mb.month).toBe(3)
    })

    it('BusinessReportShareholderData + ShareholderCompositionData', () => {
      const sh: BusinessReportShareholderData = makeBusinessReportShareholderData()
      const sc: ShareholderCompositionData = makeShareholderCompositionData()
      expect(sh.shareholderComposition[0]).toEqual(sc)
    })

    it('OfficerData + DirectorData + AuditorData optionals', () => {
      const od: OfficerData = makeOfficerData()
      const dd: DirectorData = makeDirectorData()
      const ad: AuditorData = makeAuditorData()
      expect(dd.termStart).toBeUndefined()
      expect(dd.independent).toBeUndefined()
      expect(ad.independent).toBeUndefined()
      expect(od.auditors).toHaveLength(1)
    })

    it('BoardMeetingData + JournalData + JournalEntryData + FixedAssetData + RelatedPartyData', () => {
      const bm: BoardMeetingData = makeBoardMeetingData()
      const jd: JournalData = makeJournalData()
      const je: JournalEntryData = makeJournalEntryData()
      const fa: FixedAssetData = makeFixedAssetData()
      const rp: RelatedPartyData = makeRelatedPartyData()
      expect(bm.attendees).toEqual(['Taro'])
      expect(bm.minutes).toBeUndefined()
      expect(jd.entries[0]).toEqual(je)
      expect(fa.usefulLife).toBe(5)
      expect(rp.transactionAmount).toBeUndefined()
    })

    it('CalculatedMetrics carries all seven ratios', () => {
      const cm: CalculatedMetrics = makeCalculatedMetrics()
      expect(Object.keys(cm).sort()).toEqual([
        'currentRatio',
        'debtToEquity',
        'netMargin',
        'operatingMargin',
        'revenueGrowth',
        'roa',
        'roe',
      ])
    })
  })

  // ---------------------------------------------------------------------------
  // Generation / validation / workflow / export / compliance groups
  // ---------------------------------------------------------------------------

  describe('Generation / AI group', () => {
    it('GenerationContext has required identifiers, optional context', () => {
      const ctx: GenerationContext = makeGenerationContext()
      expect(ctx.sectionType).toBe('businessOverview')
      expect(ctx.financialData).toBeUndefined()
      expect(ctx.companyInfo).toBeUndefined()
      expect(ctx.previousContent).toBeUndefined()
    })

    it('GeneratedSection carries content, sources, confidence, warnings', () => {
      const gs: GeneratedSection = makeGeneratedSection()
      expect(gs.confidence).toBe(0.9)
      expect(gs.sources).toEqual(['src'])
      expect(gs.warnings).toEqual([])
    })

    it('ValidationResult carries flag and error/warning arrays', () => {
      const vr: ValidationResult = makeValidationResult()
      expect(vr.isValid).toBe(true)
      expect(vr.errors).toEqual([])
      expect(vr.warnings).toEqual([])
    })

    it('ValidationError + ValidationWarning (suggestion optional)', () => {
      const ve: ValidationError = makeValidationError()
      const vw: ValidationWarning = makeValidationWarning()
      expect(ve.code).toBe('REQUIRED')
      expect(vw.suggestion).toBeUndefined()
    })
  })

  describe('Workflow / Export / Compliance group', () => {
    it('ApprovalStep action covers the four workflow actions (optionals)', () => {
      const actions: ApprovalStep['action'][] = ['review', 'approve', 'confirm', 'final_approve']
      expect(actions).toHaveLength(4)
      expect(new Set(actions).size).toBe(4)
      const step: ApprovalStep = makeApprovalStep()
      expect(step.userId).toBeUndefined()
      expect(step.completedAt).toBeUndefined()
      expect(step.comment).toBeUndefined()
    })

    it('WorkflowResult success/message required, step and approver optional', () => {
      const wr: WorkflowResult = makeWorkflowResult()
      expect(wr.success).toBe(true)
      expect(wr.currentStep).toBeUndefined()
      expect(wr.nextApprover).toBeUndefined()
    })

    it('ExportOptions unions cover every field', () => {
      const formats: ExportOptions['format'][] = ['pdf', 'html', 'word', 'xbrl']
      const langs: ExportOptions['language'][] = ['ja', 'en']
      const sizes: ExportOptions['pageSize'][] = ['A4', 'Letter']
      const orients: ExportOptions['orientation'][] = ['portrait', 'landscape']
      expect(formats).toHaveLength(4)
      expect(langs).toHaveLength(2)
      expect(sizes).toHaveLength(2)
      expect(orients).toHaveLength(2)
      const opts: ExportOptions = makeExportOptions()
      expect(opts.includeSupplementarySchedules).toBe(true)
    })

    it('ComplianceCheckItem status pass|fail|not_applicable (details optional)', () => {
      const statuses: ComplianceCheckItem['status'][] = ['pass', 'fail', 'not_applicable']
      expect(statuses).toHaveLength(3)
      expect(new Set(statuses).size).toBe(3)
      const item: ComplianceCheckItem = makeComplianceCheckItem()
      expect(item.details).toBeUndefined()
    })

    it('ComplianceResult aggregates items and missing requirements', () => {
      const cr: ComplianceResult = makeComplianceResult()
      expect(cr.isCompliant).toBe(true)
      expect(cr.checkedItems).toHaveLength(1)
      expect(cr.missingRequirements).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases / boundaries
  // ---------------------------------------------------------------------------

  describe('edge cases and boundaries', () => {
    it('FinancialFigure accepts zero, negative and MAX_SAFE_INTEGER values', () => {
      const zero: FinancialFigure = makeFigure({
        currentYear: 0,
        previousYear: 0,
        change: 0,
        changePercent: 0,
      })
      const negative: FinancialFigure = makeFigure({
        currentYear: -100,
        previousYear: -80,
        change: -20,
        changePercent: -25,
      })
      const max: FinancialFigure = makeFigure({
        currentYear: Number.MAX_SAFE_INTEGER,
        previousYear: Number.MAX_SAFE_INTEGER,
        change: 0,
        changePercent: 0,
      })
      expect(zero.change).toBe(0)
      expect(negative.changePercent).toBe(-25)
      expect(max.currentYear).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('collection-shaped arrays can be empty (fail-safe minimal state)', () => {
      const emptyDescription: BusinessDescription = {
        mainBusiness: 'none',
        businessSegments: [],
        recentChanges: '',
      }
      const emptyRisk: RiskManagement = { framework: '', majorRisks: [], bcp: '' }
      const emptyBoard: BoardMeetingsInfo = { heldCount: 0, attendance: [] }
      expect(emptyDescription.businessSegments).toEqual([])
      expect(emptyRisk.majorRisks).toEqual([])
      expect(emptyBoard.attendance).toEqual([])
    })

    it('CalculatedMetrics can be all-zero (degraded metrics state)', () => {
      const zero: CalculatedMetrics = {
        revenueGrowth: 0,
        operatingMargin: 0,
        netMargin: 0,
        roe: 0,
        roa: 0,
        currentRatio: 0,
        debtToEquity: 0,
      }
      expect(zero.roe).toBe(0)
    })

    it('GeneratedSection can carry a low-confidence warning state', () => {
      const gs: GeneratedSection = {
        content: '',
        sources: [],
        confidence: 0,
        warnings: ['insufficient data'],
      }
      expect(gs.confidence).toBeLessThanOrEqual(1)
      expect(gs.warnings).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Fail-safe behavior: fault modes degrade to a safe, minimal state
  // ---------------------------------------------------------------------------

  describe('fail-safe behavior', () => {
    it('ValidationResult flags invalid and enumerates errors while warnings stay safe', () => {
      const failed: ValidationResult = {
        isValid: false,
        errors: [makeValidationError(), { field: 'status', message: 'bad', code: 'INVALID' }],
        warnings: [],
      }
      expect(failed.isValid).toBe(false)
      expect(failed.errors).toHaveLength(2)
      expect(Array.isArray(failed.warnings)).toBe(true)
    })

    it('ComplianceResult flags non-compliance and lists missing requirements', () => {
      const nonCompliant: ComplianceResult = {
        isCompliant: false,
        checkedItems: [
          { requirement: 'X', legalBasis: 'Act', status: 'fail' },
          { requirement: 'Y', legalBasis: 'Act', status: 'not_applicable' },
        ],
        missingRequirements: ['X'],
      }
      expect(nonCompliant.isCompliant).toBe(false)
      expect(nonCompliant.missingRequirements).toContain('X')
    })

    it('WorkflowResult reports failure without advancing optional step/approver', () => {
      const failed: WorkflowResult = { success: false, message: 'rejected by reviewer' }
      expect(failed.success).toBe(false)
      expect(failed.currentStep).toBeUndefined()
      expect(failed.nextApprover).toBeUndefined()
    })

    it('ImportantMattersSection and SupplementarySchedules degrade to empty objects', () => {
      const matters: ImportantMattersSection = {}
      const schedules: SupplementarySchedules = {}
      expect(matters).toEqual({})
      expect(schedules).toEqual({})
    })

    it('RelatedPartyTransactionsSection can report no transactions safely', () => {
      const none: RelatedPartyTransactionsSection = {
        hasTransactions: false,
        summary: 'none',
        armLengthConfirmation: 'n/a',
      }
      expect(none.hasTransactions).toBe(false)
      expect(none.transactions).toBeUndefined()
    })
  })
})
