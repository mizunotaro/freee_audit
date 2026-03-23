export type ReportTemplateType = 'simple' | 'keidanren'
export type BusinessReportStatus = 'draft' | 'under_review' | 'approved' | 'finalized'

export interface BusinessReportData {
  fiscalYear: number
  companyName: string
  businessOverview: string
  businessEnvironment: string
  managementPolicy: string
  issuesAndRisks: string
  financialHighlights: string
  researchAndDevelopment: string
  corporateGovernance: string
}

export interface BusinessReportSection {
  key: keyof Omit<BusinessReportData, 'fiscalYear' | 'companyName'>
  title: string
  description: string
}

export interface KeidanrenBusinessReport {
  id: string
  companyId: string
  companyName: string
  fiscalYear: number
  version: number
  status: BusinessReportStatus
  createdAt: Date
  updatedAt: Date
  approvedBy?: string
  approvedAt?: Date
  templateVersion: string
  templateType: 'keidanren_standard' | 'keidanren_simplified' | 'custom'

  companyStatus: CompanyStatusSection
  shares: SharesSection
  stockOptions: StockOptionsSection
  officers: OfficersSection
  auditor: AuditorSection
  internalControl: InternalControlSection
  controlPolicy: ControlPolicySection
  subsidiary: SubsidiarySection
  relatedPartyTransactions: RelatedPartyTransactionsSection
  importantMatters: ImportantMattersSection
  supplementarySchedules?: SupplementarySchedules
}

export interface CompanyStatusSection {
  businessDescription: BusinessDescription
  businessPerformance: BusinessPerformance
  productionOrders?: ProductionOrders
  financialSummary: FinancialSummary
  riskManagement: RiskManagement
  esg?: ESGSection
}

export interface BusinessDescription {
  mainBusiness: string
  businessSegments: BusinessSegment[]
  recentChanges: string
}

export interface BusinessSegment {
  name: string
  description: string
  revenue: number
  percentage: number
}

export interface BusinessPerformance {
  revenue: FinancialFigure
  operatingIncome: FinancialFigure
  ordinaryIncome: FinancialFigure
  netIncome: FinancialFigure
  yearOverYear: YearOverYearComparison[]
  analysis: string
}

export interface FinancialFigure {
  currentYear: number
  previousYear: number
  change: number
  changePercent: number
}

export interface YearOverYearComparison {
  item: string
  currentValue: number
  previousValue: number
  changePercent: number
  analysis: string
}

export interface ProductionOrders {
  productionVolume: ProductionData[]
  orderStatus: string
  capacityUtilization?: number
}

export interface ProductionData {
  period: string
  volume: number
  unit: string
}

export interface FinancialSummary {
  balanceSheet: BalanceSheetSummary
  incomeStatement: IncomeStatementSummary
  cashFlowStatement: CashFlowSummary
  keyRatios: FinancialRatio[]
}

export interface BalanceSheetSummary {
  totalAssets: FinancialFigure
  currentAssets: FinancialFigure
  fixedAssets: FinancialFigure
  currentLiabilities: FinancialFigure
  fixedLiabilities: FinancialFigure
  netAssets: FinancialFigure
  totalLiabilitiesAndNetAssets: FinancialFigure
}

export interface IncomeStatementSummary {
  revenue: FinancialFigure
  costOfSales: FinancialFigure
  grossProfit: FinancialFigure
  sellingGeneralAdminExpenses: FinancialFigure
  operatingIncome: FinancialFigure
  nonOperatingIncome: FinancialFigure
  nonOperatingExpenses: FinancialFigure
  ordinaryIncome: FinancialFigure
  extraordinaryIncome: FinancialFigure
  extraordinaryLoss: FinancialFigure
  incomeBeforeTax: FinancialFigure
  corporateTax: FinancialFigure
  netIncome: FinancialFigure
}

export interface CashFlowSummary {
  operatingActivities: FinancialFigure
  investingActivities: FinancialFigure
  financingActivities: FinancialFigure
  freeCashFlow: FinancialFigure
  cashEquivalentEnd: FinancialFigure
}

export interface FinancialRatio {
  name: string
  currentValue: number
  previousValue: number
  unit: 'percent' | 'ratio' | 'times' | 'days'
}

export interface RiskManagement {
  framework: string
  majorRisks: RiskItem[]
  bcp: string
}

export interface RiskItem {
  category: string
  description: string
  probability: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low'
  mitigation: string
}

export interface ESGSection {
  environmental: ESGItem
  social: ESGItem
  governance: ESGItem
}

export interface ESGItem {
  initiatives: string
  metrics: ESGMetric[]
  targets: string
}

export interface ESGMetric {
  name: string
  value: number
  unit: string
  year: number
}

export interface SharesSection {
  totalShares: TotalShares
  shareholdingStructure: ShareholdingStructure
  majorShareholders: MajorShareholder[]
  stockPrice?: StockPriceInfo
  treasuryShares?: TreasuryShares
}

export interface TotalShares {
  authorized: number
  issued: number
  treasury: number
  outstanding: number
}

export interface ShareholdingStructure {
  byType: ShareholderTypeBreakdown[]
  byRegion?: RegionalBreakdown[]
  concentration: number
}

export interface ShareholderTypeBreakdown {
  type:
    | 'financial_institution'
    | 'corporation'
    | 'individual'
    | 'foreign_investor'
    | 'treasury'
    | 'other'
  numberOfShares: number
  percentage: number
  numberOfShareholders?: number
}

export interface RegionalBreakdown {
  region: string
  numberOfShares: number
  percentage: number
}

export interface MajorShareholder {
  rank: number
  name: string
  numberOfShares: number
  percentage: number
  type: 'financial_institution' | 'corporation' | 'individual' | 'foreign_investor' | 'other'
  notes?: string
}

export interface StockPriceInfo {
  high52Week: number
  low52Week: number
  yearEnd: number
  dividend: DividendInfo
  tradingVolume?: number
}

export interface DividendInfo {
  dividendPerShare: number
  dividendYield: number
  payoutRatio: number
  dividendPolicy: string
}

export interface TreasuryShares {
  beginningBalance: number
  acquisitions: TreasuryShareTransaction[]
  dispositions: TreasuryShareTransaction[]
  endingBalance: number
}

export interface TreasuryShareTransaction {
  date: Date
  numberOfShares: number
  pricePerShare?: number
  purpose: string
}

export interface StockOptionsSection {
  stockAcquisitionRights: StockAcquisitionRight[]
  equityCompensation?: EquityCompensationPlan[]
  exerciseStatus: ExerciseStatus[]
}

export interface StockAcquisitionRight {
  type: string
  grantDate: Date
  beneficiaries: number
  numberOfShares: number
  exercisePrice: number
  exercisePeriodStart: Date
  exercisePeriodEnd: Date
  vestingSchedule?: string
}

export interface EquityCompensationPlan {
  planName: string
  planType: 'rsu' | 'stock_option' | 'restricted_stock' | 'performance_share'
  eligibleParticipants: string
  totalSharesReserved: number
  grantedShares: number
  vestingConditions: string
}

export interface ExerciseStatus {
  fiscalYear: number
  exercisedRights: number
  exercisedShares: number
  exerciseAmount: number
}

export interface OfficersSection {
  directors: Director[]
  auditors: Auditor[]
  executiveOfficers?: ExecutiveOfficer[]
  compensation: OfficersCompensation
  boardMeetings: BoardMeetingsInfo
}

export interface Director {
  id: string
  name: string
  position:
    | 'chairman'
    | 'president'
    | 'vice_president'
    | 'director'
    | 'managing_director'
    | 'senior_managing_director'
  termStart: Date
  termEnd: Date
  attendance: number
  background: string
  otherPositions?: string[]
  independent: boolean
  committees?: string[]
}

export interface Auditor {
  id: string
  name: string
  position: 'full_time' | 'part_time' | 'standing'
  termStart: Date
  termEnd: Date
  attendance: number
  background: string
  independent: boolean
}

export interface ExecutiveOfficer {
  id: string
  name: string
  title: string
  responsibilities: string
  appointedDate: Date
}

export interface OfficersCompensation {
  directors: CompensationBreakdown
  auditors: CompensationBreakdown
  executiveOfficers?: CompensationBreakdown
  total: number
  policy: string
}

export interface CompensationBreakdown {
  baseCompensation: number
  bonus: number
  stockCompensation: number
  retirementAllowance: number
  total: number
  numberOfPersons: number
}

export interface BoardMeetingsInfo {
  heldCount: number
  attendance: AttendanceRecord[]
}

export interface AttendanceRecord {
  name: string
  position: string
  meetingsHeld: number
  meetingsAttended: number
  attendanceRate: number
}

export interface AuditorSection {
  name: string
  firm: string
  engagementPeriod: DateRange
  auditOpinion: AuditOpinion
  auditFees: AuditFees
  changes?: AuditorChange[]
}

export interface DateRange {
  start: Date
  end: Date
}

export interface AuditOpinion {
  type: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer'
  summary: string
  reportDate: Date
  emphasisOfMatter?: string
}

export interface AuditFees {
  auditFee: number
  nonAuditFee: number
  total: number
  nonAuditServices?: string[]
}

export interface AuditorChange {
  date: Date
  previousAuditor: string
  newAuditor: string
  reason: string
}

export interface InternalControlSection {
  basicPolicy: string
  organizationalStructure: OrganizationalStructure
  internalControlReport?: InternalControlReport
  compliance: ComplianceInfo
  riskManagementSystem: string
}

export interface OrganizationalStructure {
  boardOfDirectors: string
  auditSystem: string
  nominationCommittee?: string
  compensationCommittee?: string
  advisoryCommittees?: string[]
}

export interface InternalControlReport {
  assessmentDate: Date
  conclusion: 'effective' | 'ineffective'
  materialWeaknesses: string[]
  significantDeficiencies: string[]
  remediation?: string
}

export interface ComplianceInfo {
  policy: string
  training: string
  whistleblowing: string
  violations?: ComplianceViolation[]
}

export interface ComplianceViolation {
  date: Date
  description: string
  correctiveAction: string
}

export interface ControlPolicySection {
  hasPolicy: boolean
  policyContent?: string
  takeoverDefense?: TakeoverDefenseInfo
  capitalPolicy: string
}

export interface TakeoverDefenseInfo {
  hasMeasures: boolean
  measures: string
  adoptionDate?: Date
  expirationDate?: Date
  triggerEvents?: string[]
}

export interface SubsidiarySection {
  isWhollyOwnedSubsidiary: boolean
  parentCompany?: ParentCompanyInfo
  specialMatters?: string
}

export interface ParentCompanyInfo {
  name: string
  address: string
  relationship: string
  ownershipPercentage: number
}

export interface RelatedPartyTransactionsSection {
  hasTransactions: boolean
  transactions?: RelatedPartyTransaction[]
  summary: string
  armLengthConfirmation: string
}

export interface RelatedPartyTransaction {
  partyName: string
  relationship: string
  transactionType: string
  amount: number
  terms: string
  outstandingBalance?: number
}

export interface ImportantMattersSection {
  subsequentEvents?: SubsequentEvent[]
  otherMatters?: string
  litigation?: LitigationMatter[]
  incidents?: IncidentReport[]
}

export interface SubsequentEvent {
  date: Date
  description: string
  impact: 'material' | 'immaterial'
  financialEffect?: number
  accountingTreatment?: string
}

export interface LitigationMatter {
  caseName: string
  plaintiffDefendant: string
  filingDate: Date
  claimedAmount?: number
  currentStatus: string
  potentialImpact: string
}

export interface IncidentReport {
  date: Date
  type: 'disaster' | 'accident' | 'cyber_incident' | 'other'
  description: string
  damage: string
  responseMeasures: string
  financialImpact?: number
}

export interface SupplementarySchedules {
  securitiesDetails?: string
  relatedPartyDetails?: string
  officerCompensationDetails?: string
}

export interface AggregatedReportData {
  companyInfo: CompanyInfo
  financialData: FinancialData
  shareholders: BusinessReportShareholderData
  officers: OfficerData
  boardMeetings: BoardMeetingData[]
  journals: JournalData
  fixedAssets: FixedAssetData[]
  relatedParties: RelatedPartyData[]
  calculatedMetrics: CalculatedMetrics
}

export interface CompanyInfo {
  id: string
  name: string
  fiscalYearStart: number
  industry?: string
  foundedDate?: Date
  capital?: number
  employeeCount?: number
}

export interface FinancialData {
  monthlyBalances: MonthlyBalanceData[]
  currentYearTotals: Record<string, number>
  previousYearTotals: Record<string, number>
}

export interface MonthlyBalanceData {
  month: number
  fiscalYear: number
  category: string
  accountName: string
  amount: number
}

export interface BusinessReportShareholderData {
  totalShares: number
  shareholderComposition: ShareholderCompositionData[]
}

export interface ShareholderCompositionData {
  type: string
  numberOfShares: number
  percentage: number
}

export interface OfficerData {
  directors: DirectorData[]
  auditors: AuditorData[]
}

export interface DirectorData {
  id: string
  name: string
  position: string
  termStart?: Date
  termEnd?: Date
  independent?: boolean
}

export interface AuditorData {
  id: string
  name: string
  position: string
  independent?: boolean
}

export interface BoardMeetingData {
  id: string
  date: Date
  title: string
  attendees: string[]
  minutes?: string
}

export interface JournalData {
  entries: JournalEntryData[]
  totals: Record<string, number>
}

export interface JournalEntryData {
  id: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
}

export interface FixedAssetData {
  id: string
  name: string
  acquisitionCost: number
  accumulatedDep: number
  bookValue: number
  usefulLife: number
}

export interface RelatedPartyData {
  name: string
  relationship: string
  transactionAmount?: number
}

export interface CalculatedMetrics {
  revenueGrowth: number
  operatingMargin: number
  netMargin: number
  roe: number
  roa: number
  currentRatio: number
  debtToEquity: number
}

export interface GenerationContext {
  sectionType: string
  companyName: string
  fiscalYear: number
  financialData?: FinancialData
  companyInfo?: CompanyInfo
  previousContent?: string
}

export interface GeneratedSection {
  content: string
  sources: string[]
  confidence: number
  warnings: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

export interface ApprovalStep {
  role: string
  action: 'review' | 'approve' | 'confirm' | 'final_approve'
  required: boolean
  userId?: string
  completedAt?: Date
  comment?: string
}

export interface WorkflowResult {
  success: boolean
  currentStep?: number
  message: string
  nextApprover?: string
}

export interface ExportOptions {
  format: 'pdf' | 'html' | 'word' | 'xbrl'
  includeSupplementarySchedules: boolean
  language: 'ja' | 'en'
  pageSize: 'A4' | 'Letter'
  orientation: 'portrait' | 'landscape'
}

export interface ComplianceResult {
  isCompliant: boolean
  checkedItems: ComplianceCheckItem[]
  missingRequirements: string[]
}

export interface ComplianceCheckItem {
  requirement: string
  legalBasis: string
  status: 'pass' | 'fail' | 'not_applicable'
  details?: string
}

export const SIMPLE_REPORT_SECTIONS: BusinessReportSection[] = [
  {
    key: 'businessOverview',
    title: '1. 事業の概要',
    description: '会社の主な事業内容、主要製品・サービス、市場ポジションなど',
  },
  {
    key: 'businessEnvironment',
    title: '2. 経営環境',
    description: '業界の動向、競合状況、法規制、経済情勢など',
  },
  {
    key: 'managementPolicy',
    title: '3. 経営方針',
    description: '経営理念、中長期戦略、成長目標など',
  },
  {
    key: 'issuesAndRisks',
    title: '4. 課題とリスク',
    description: '直面している課題、潜在的リスクと対策',
  },
  {
    key: 'financialHighlights',
    title: '5. 財務ハイライト',
    description: '売上高、利益、キャッシュフロー等の主要財務指標',
  },
  {
    key: 'researchAndDevelopment',
    title: '6. 研究開発活動',
    description: 'R&D投資、技術開発の状況、知的財産戦略など',
  },
  {
    key: 'corporateGovernance',
    title: '7. 企業統治',
    description: 'コーポレートガバナンス体制、内部統制、コンプライアンスなど',
  },
]

export const KEIDANREN_REPORT_SECTIONS = [
  {
    id: 'companyStatus',
    title: '1. 株式会社の現況に関する事項',
    subSections: [
      { id: 'businessDescription', title: '1-1 事業の内容' },
      { id: 'businessPerformance', title: '1-2 業績の概況' },
      { id: 'productionOrders', title: '1-3 生産・受注の状況' },
      { id: 'financialSummary', title: '1-4 財務諸表の要約' },
      { id: 'riskManagement', title: '1-5 リスク管理体制' },
    ],
  },
  {
    id: 'shares',
    title: '2. 株式に関する事項',
    subSections: [
      { id: 'totalShares', title: '2-1 発行済株式総数' },
      { id: 'shareholdingStructure', title: '2-2 株式の状況' },
      { id: 'majorShareholders', title: '2-3 大株主の状況' },
      { id: 'stockPrice', title: '2-4 株価の状況' },
    ],
  },
  {
    id: 'stockOptions',
    title: '3. 新株予約権等に関する事項',
    subSections: [
      { id: 'stockAcquisitionRights', title: '3-1 新株予約権' },
      { id: 'exerciseStatus', title: '3-2 行使状況' },
    ],
  },
  {
    id: 'officers',
    title: '4. 会社役員に関する事項',
    subSections: [
      { id: 'directors', title: '4-1 取締役' },
      { id: 'auditors', title: '4-2 監査役' },
      { id: 'compensation', title: '4-3 役員報酬' },
      { id: 'boardMeetings', title: '4-4 取締役会の状況' },
    ],
  },
  {
    id: 'auditor',
    title: '5. 会計監査人に関する事項',
    subSections: [
      { id: 'auditorInfo', title: '5-1 会計監査人' },
      { id: 'auditOpinion', title: '5-2 監査意見' },
      { id: 'auditFees', title: '5-3 監査報酬' },
    ],
  },
  {
    id: 'internalControl',
    title: '6. 業務の適正を確保するための体制等',
    subSections: [
      { id: 'basicPolicy', title: '6-1 内部統制システムの基本方針' },
      { id: 'organizationalStructure', title: '6-2 組織体制' },
      { id: 'compliance', title: '6-3 コンプライアンス' },
    ],
  },
  {
    id: 'controlPolicy',
    title: '7. 株式会社の支配に関する基本方針',
    subSections: [
      { id: 'policyContent', title: '7-1 支配基本方針' },
      { id: 'takeoverDefense', title: '7-2 買収防衛策' },
    ],
  },
  {
    id: 'subsidiary',
    title: '8. 特定完全子会社に関する事項',
    subSections: [{ id: 'parentCompany', title: '8-1 親会社の状況' }],
  },
  {
    id: 'relatedPartyTransactions',
    title: '9. 親会社等との間の取引',
    subSections: [{ id: 'transactions', title: '9-1 関連当事者取引' }],
  },
  {
    id: 'importantMatters',
    title: '10. 株式会社の状況に関する重要な事項',
    subSections: [
      { id: 'subsequentEvents', title: '10-1 後発事象' },
      { id: 'litigation', title: '10-2 訴訟等' },
      { id: 'otherMatters', title: '10-3 その他重要事項' },
    ],
  },
] as const
