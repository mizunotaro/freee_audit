/**
 * 会計基準変換機能の型定義
 * Accounting Standard Conversion Type Definitions
 */

import type { AccountingStandard } from './accounting-standard'

export type { AccountingStandard }

/**
 * 会計基準の詳細情報
 * Accounting standard information
 */
export interface AccountingStandardInfo {
  /** 会計基準コード */
  code: AccountingStandard
  /** 表示名（日本語） */
  name: string
  /** 表示名（英語） */
  nameEn: string
  /** 説明 */
  description?: string
  /** 国コード */
  countryCode: string
}

/**
 * 勘定科目カテゴリ
 * Account category types
 */
export type AccountCategory =
  | 'current_asset'
  | 'fixed_asset'
  | 'deferred_asset'
  | 'current_liability'
  | 'fixed_liability'
  | 'deferred_liability'
  | 'equity'
  | 'revenue'
  | 'cogs'
  | 'sga_expense'
  | 'non_operating_income'
  | 'non_operating_expense'
  | 'extraordinary_income'
  | 'extraordinary_loss'

/**
 * 勘定科目項目
 * Chart of account item
 */
export interface ChartOfAccountItem {
  /** 項目ID */
  id: string
  /** 勘定科目コード */
  code: string
  /** 日本語名 */
  name: string
  /** 英語名 */
  nameEn: string
  /** 会計基準 */
  standard: AccountingStandard
  /** カテゴリ */
  category: AccountCategory
  /** サブカテゴリ */
  subcategory?: string
  /** 借方/貸方 */
  normalBalance: 'debit' | 'credit'
  /** 親科目ID */
  parentId?: string
  /** 階層レベル（0=ルート） */
  level: number
  /** 変換対象フラグ */
  isConvertible: boolean
  /** メタデータ */
  metadata?: Record<string, unknown>
}

/**
 * 勘定科目一覧
 * Chart of accounts
 */
export interface ChartOfAccounts {
  /** ID */
  id: string
  /** 会社ID */
  companyId: string
  /** 会計基準 */
  standard: AccountingStandard
  /** 名称 */
  name: string
  /** 説明 */
  description?: string
  /** 勘定科目項目一覧 */
  items: ChartOfAccountItem[]
  /** バージョン */
  version: number
  /** 有効フラグ */
  isActive: boolean
  /** デフォルトフラグ */
  isDefault?: boolean
  /** 作成日時 */
  createdAt: Date
  /** 更新日時 */
  updatedAt: Date
}

/**
 * マッピング条件
 * Mapping condition for conditional rules
 */
export interface MappingCondition {
  /** フィールド名 */
  field: string
  /** 演算子 */
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between'
  /** 値 */
  value: string | number
  /** ターゲット勘定科目ID */
  targetAccountId: string
}

/**
 * 変換ルール
 * Conversion rule for account mapping
 */
export interface ConversionRule {
  /** ルールタイプ */
  type: 'direct' | 'percentage' | 'formula' | 'ai_suggested'
  /** 配分比率 */
  percentage?: number
  /** 計算式 */
  formula?: string
  /** 条件付きルール */
  conditions?: MappingCondition[]
}

/**
 * 勘定科目マッピング
 * Account mapping between source and target
 */
export interface AccountMapping {
  /** ID */
  id: string
  /** ソース勘定科目ID */
  sourceAccountId: string
  /** ソース勘定科目ID（エイリアス） */
  sourceItemId?: string
  /** ソース勘定科目コード */
  sourceAccountCode: string
  /** ソース勘定科目名 */
  sourceAccountName: string
  /** ターゲット勘定科目ID */
  targetAccountId: string
  /** ターゲット勘定科目ID（エイリアス） */
  targetItemId?: string
  /** ターゲット勘定科目コード */
  targetAccountCode: string
  /** ターゲット勘定科目名 */
  targetAccountName: string
  /** マッピングタイプ */
  mappingType: MappingType
  /** 変換ルール */
  conversionRule?: ConversionRule
  /** 配分比率（1toNの場合） */
  percentage?: number
  /** AI推奨の信頼度（0-1） */
  confidence: number
  /** 手動レビューが必要か */
  isManualReview: boolean
  /** 備考 */
  notes?: string
}

/**
 * 変換ステータス
 * Conversion project status
 */
export type ConversionStatus =
  | 'draft'
  | 'mapping'
  | 'validating'
  | 'converting'
  | 'reviewing'
  | 'completed'
  | 'error'

export type ApprovalStage =
  | 'mapping_review'
  | 'rationale_review'
  | 'adjustment_review'
  | 'fs_review'
  | 'final_approval'

export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated'

export type AuditAction =
  | 'project_create'
  | 'project_update'
  | 'project_delete'
  | 'project_execute'
  | 'project_abort'
  | 'mapping_create'
  | 'mapping_update'
  | 'mapping_delete'
  | 'mapping_approve'
  | 'mapping_batch_approve'
  | 'rationale_create'
  | 'rationale_update'
  | 'rationale_review'
  | 'adjustment_create'
  | 'adjustment_update'
  | 'adjustment_approve'
  | 'approval_submit'
  | 'approval_approve'
  | 'approval_reject'
  | 'approval_escalate'
  | 'export_generate'

export type MappingType = '1to1' | '1toN' | 'Nto1' | 'complex'

export interface ConversionProgress {
  status: ConversionStatus
  progress: number
  processedJournals: number
  totalJournals: number
  errors: ConversionError[]
  startedAt?: Date | string
  estimatedCompletion?: Date | string
  currentItem?: string
}

/**
 * 変換設定
 * Conversion project settings
 */
export interface ConversionSettings {
  /** 仕訳を含める */
  includeJournals: boolean
  /** 財務諸表を含める */
  includeFinancialStatements: boolean
  /** 調整仕訳を生成する */
  generateAdjustingEntries: boolean
  /** AIアシストマッピングを使用する */
  aiAssistedMapping: boolean
  /** 為替換算レート */
  currencyConversionRate?: number
  /** 機能通貨 */
  functionalCurrency?: string
  /** 表示通貨 */
  presentationCurrency?: string
}

/**
 * 変換統計情報
 * Conversion statistics
 */
export interface ConversionStatistics {
  /** 総勘定科目数 */
  totalAccounts: number
  /** マッピング済み勘定科目数 */
  mappedAccounts: number
  /** レビュー必要数 */
  reviewRequiredCount: number
  /** 総仕訳数 */
  totalJournals: number
  /** 変換済み仕訳数 */
  convertedJournals: number
  /** 調整仕訳数 */
  adjustingEntryCount: number
  /** 平均信頼度 */
  averageConfidence: number
}

/**
 * 変換プロジェクト
 * Conversion project
 */
export interface ConversionProject {
  /** ID */
  id: string
  /** 会社ID */
  companyId: string
  /** プロジェクト名 */
  name: string
  /** 説明 */
  description?: string
  /** ソース会計基準（常にJGAAP） */
  sourceStandard: AccountingStandard
  /** ターゲット会計基準 */
  targetStandard: AccountingStandard
  /** ターゲットCOA ID */
  targetCoaId: string
  /** 期間開始日 */
  periodStart: Date
  /** 期間終了日 */
  periodEnd: Date
  /** ステータス */
  status: ConversionStatus
  /** 進捗（0-100） */
  progress: number
  /** 設定 */
  settings: ConversionSettings
  /** 統計情報 */
  statistics?: ConversionStatistics
  /** 作成者 */
  createdBy: string
  /** 作成日時 */
  createdAt: Date
  /** 更新日時 */
  updatedAt: Date
  /** 完了日時 */
  completedAt?: Date
}

/**
 * 変換済み仕訳明細
 * Converted journal line
 */
export interface ConvertedJournalLine {
  /** ソース勘定科目コード */
  sourceAccountCode: string
  /** ソース勘定科目名 */
  sourceAccountName: string
  /** ターゲット勘定科目コード */
  targetAccountCode: string
  /** ターゲット勘定科目名 */
  targetAccountName: string
  /** 借方金額 */
  debitAmount: number
  /** 貸方金額 */
  creditAmount: number
  /** マッピングID */
  mappingId: string
}

/**
 * 仕訳変換結果
 * Journal conversion result
 */
export interface JournalConversion {
  /** ソース仕訳ID */
  sourceJournalId: string
  /** ソース日付 */
  sourceDate: Date
  /** ソース説明 */
  sourceDescription: string
  /** 変換済み明細行 */
  lines: ConvertedJournalLine[]
  /** マッピング信頼度 */
  mappingConfidence: number
  /** レビュー必要フラグ */
  requiresReview: boolean
  /** レビューノート */
  reviewNotes?: string
}

/**
 * 調整仕訳タイプ
 * Adjustment entry types
 */
export type AdjustmentType =
  | 'revenue_recognition'
  | 'lease_classification'
  | 'financial_instrument'
  | 'business_combination'
  | 'deferred_tax'
  | 'retirement_benefit'
  | 'foreign_currency'
  | 'goodwill_impairment'
  | 'other'

/**
 * 調整仕訳明細行
 * Adjusting entry line
 */
export interface AdjustingEntryLine {
  /** 勘定科目コード */
  accountCode: string
  /** 勘定科目名 */
  accountName: string
  /** 借方金額 */
  debit: number
  /** 貸方金額 */
  credit: number
}

/**
 * 調整仕訳
 * Adjusting entry
 */
export interface AdjustingEntry {
  /** ID */
  id: string
  /** プロジェクトID */
  projectId: string
  /** 調整タイプ */
  type: AdjustmentType
  /** 説明（日本語） */
  description: string
  /** 説明（英語） */
  descriptionEn?: string
  /** 明細行 */
  lines: AdjustingEntryLine[]
  /** IFRS段落参照 */
  ifrsReference?: string
  /** ASC参照 */
  usgaapReference?: string
  /** AI推奨フラグ */
  aiSuggested: boolean
  /** 承認済みフラグ */
  isApproved: boolean
}

/**
 * 開示注記カテゴリ
 * Disclosure note categories
 */
export type DisclosureCategory =
  | 'significant_accounting_policies'
  | 'basis_of_conversion'
  | 'standard_differences'
  | 'adjusting_entries'
  | 'fair_value_measurement'
  | 'related_party'
  | 'subsequent_events'
  | 'commitments_contingencies'
  | 'segment_information'
  | 'foreign_currency'
  | 'revenue_recognition'
  | 'lease_obligations'
  | 'financial_instruments'
  | 'other'

/**
 * 開示注記
 * Disclosure note
 */
export interface DisclosureNote {
  /** ID */
  id: string
  /** カテゴリ */
  category: DisclosureCategory
  /** タイトル（日本語） */
  title: string
  /** タイトル（英語） */
  titleEn: string
  /** 内容（日本語） */
  content: string
  /** 内容（英語） */
  contentEn?: string
  /** 基準参照（"ASC 840" or "IAS 17"） */
  standardReference: string
  /** 表示順 */
  order: number
  /** 生成フラグ */
  isGenerated: boolean
}

/**
 * 開示テーブル
 * Disclosure table
 */
export interface DisclosureTable {
  id: string
  title: string
  titleEn?: string
  headers: string[]
  rows: string[][]
  footnotes?: string[]
}

/**
 * 開示セクション
 * Disclosure section
 */
export interface DisclosureSection {
  id: string
  title: string
  titleEn: string
  content: string
  contentEn?: string
  order: number
  subsections?: DisclosureSection[]
  tables?: DisclosureTable[]
}

/**
 * 開示文書の標準参照
 * Disclosure standard reference
 */
export interface DisclosureStandardReference {
  id: string
  referenceNumber: string
  title: string
  source: string
  order?: number
}

/**
 * 開示文書
 * Disclosure document
 */
export interface DisclosureDocument {
  id: string
  projectId: string
  category: DisclosureCategory

  title: string
  titleEn: string

  content: string
  contentEn?: string

  sections: DisclosureSection[]

  standardReferences: DisclosureStandardReference[]
  relatedRationaleIds: string[]

  isGenerated: boolean
  isAiEnhanced: boolean
  generatedAt: Date
  updatedAt: Date
  reviewedBy?: string
  reviewedAt?: Date
  sortOrder: number
}

/**
 * AI強化された開示文書のレスポンス
 * AI enhanced disclosure response
 */
export interface AIEnhancedDisclosure {
  enhancedContent: string
  enhancedContentEn: string
  addedReferences: string[]
  improvements: string[]
}

/**
 * 変換警告
 * Conversion warning
 */
export interface ConversionWarning {
  /** コード */
  code: string
  /** メッセージ */
  message: string
  /** 詳細 */
  details?: Record<string, unknown>
}

/**
 * 変換エラー
 * Conversion error
 */
export interface ConversionError {
  /** コード */
  code: string
  /** メッセージ */
  message: string
  /** 影響を受ける項目 */
  affectedItem?: string
  /** スタックトレース */
  stack?: string
}

/**
 * 変換済み貸借対照表
 * Converted balance sheet
 */
export interface ConvertedBalanceSheet {
  /** 基準日 */
  asOfDate: Date
  /** 資産項目 */
  assets: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 負債項目 */
  liabilities: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 株主資本項目 */
  equity: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 資産合計 */
  totalAssets: number
  /** 負債合計 */
  totalLiabilities: number
  /** 株主資本合計 */
  totalEquity: number
}

/**
 * 変換済み損益計算書
 * Converted profit and loss statement
 */
export interface ConvertedProfitLoss {
  /** 期間開始日 */
  periodStart: Date
  /** 期間終了日 */
  periodEnd: Date
  /** 売上高項目 */
  revenue: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 売上原価項目 */
  costOfSales: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 販売費及び一般管理費項目 */
  sgaExpenses: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 営業外収益項目 */
  nonOperatingIncome: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 営業外費用項目 */
  nonOperatingExpenses: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 売上総利益 */
  grossProfit: number
  /** 営業利益 */
  operatingIncome: number
  /** 経常利益 */
  ordinaryIncome: number
  /** 税引前当期純利益 */
  incomeBeforeTax: number
  /** 当期純利益 */
  netIncome: number
}

/**
 * 変換済みキャッシュフロー計算書
 * Converted cash flow statement
 */
export interface ConvertedCashFlow {
  /** 期間開始日 */
  periodStart: Date
  /** 期間終了日 */
  periodEnd: Date
  /** 営業活動キャッシュフロー */
  operatingActivities: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 投資活動キャッシュフロー */
  investingActivities: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 財務活動キャッシュフロー */
  financingActivities: Array<{
    code: string
    name: string
    nameEn: string
    amount: number
    sourceAccountCode?: string
  }>
  /** 営業活動によるキャッシュフロー合計 */
  netCashFromOperating: number
  /** 投資活動によるキャッシュフロー合計 */
  netCashFromInvesting: number
  /** 財務活動によるキャッシュフロー合計 */
  netCashFromFinancing: number
  /** 現金及び現金同等物の純増減 */
  netChangeInCash: number
}

/**
 * マッピング推論の代替案
 * Mapping suggestion alternative
 */
export interface MappingSuggestionAlternative {
  /** 勘定科目コード */
  code: string
  /** 勘定科目名 */
  name: string
  /** 信頼度 */
  confidence: number
}

/**
 * マッピング推論
 * AI mapping suggestion
 */
export interface MappingSuggestion {
  /** ソース勘定科目コード */
  sourceAccountCode: string
  /** ソース勘定科目名 */
  sourceAccountName: string
  /** 推奨ターゲットコード */
  suggestedTargetCode: string
  /** 推奨ターゲット名 */
  suggestedTargetName: string
  /** 信頼度（0-1） */
  confidence: number
  /** 推論理由 */
  reasoning: string
  /** 代替案 */
  alternatives: MappingSuggestionAlternative[]
}

/**
 * 調整推奨の推定影響
 * Estimated impact of adjustment recommendation
 */
export interface AdjustmentRecommendationImpact {
  /** 資産変動額 */
  assetChange?: number
  /** 負債変動額 */
  liabilityChange?: number
  /** 株主資本変動額 */
  equityChange?: number
  /** 当期純利益変動額 */
  netIncomeChange?: number
}

/**
 * 調整推奨
 * AI adjustment recommendation
 */
export interface AdjustmentRecommendation {
  /** 調整タイプ */
  type: AdjustmentType
  /** 優先度 */
  priority: 'high' | 'medium' | 'low'
  /** タイトル */
  title: string
  /** 説明 */
  description: string
  /** 推定影響 */
  estimatedImpact: AdjustmentRecommendationImpact
  /** 推論理由 */
  reasoning: string
  /** 参照文献 */
  references: string[]
}

/**
 * リスク評価
 * Risk assessment
 */
export interface RiskAssessment {
  /** カテゴリ */
  category: string
  /** リスクレベル */
  riskLevel: 'low' | 'medium' | 'high'
  /** 説明 */
  description: string
  /** 軽減策の提案 */
  mitigationSuggestion: string
}

/**
 * AI変換分析
 * AI conversion analysis
 */
export interface AIConversionAnalysis {
  /** ID */
  id: string
  /** プロジェクトID */
  projectId: string
  /** マッピング推論一覧 */
  mappingSuggestions: MappingSuggestion[]
  /** 調整推奨一覧 */
  adjustmentRecommendations: AdjustmentRecommendation[]
  /** リスク評価一覧 */
  riskAssessments: RiskAssessment[]
  /** 品質スコア（0-100） */
  qualityScore: number
  /** 生成日時 */
  generatedAt: Date
  /** 使用モデル */
  modelUsed: string
}

/**
 * 変換結果
 * Conversion result
 */
export interface ConversionResult {
  /** ID */
  id: string
  /** プロジェクトID */
  projectId: string
  /** 仕訳変換結果 */
  journalConversions?: JournalConversion[]
  /** 変換済み貸借対照表 */
  balanceSheet?: ConvertedBalanceSheet
  /** 変換済み損益計算書 */
  profitLoss?: ConvertedProfitLoss
  /** 変換済みキャッシュフロー計算書 */
  cashFlow?: ConvertedCashFlow
  /** 調整仕訳一覧 */
  adjustingEntries?: AdjustingEntry[]
  /** 開示注記一覧 */
  disclosures?: DisclosureNote[]
  /** AI分析 */
  aiAnalysis?: AIConversionAnalysis
  /** 変換日時 */
  conversionDate: Date
  /** 変換所要時間（ミリ秒） */
  conversionDurationMs: number
  /** 警告一覧 */
  warnings: ConversionWarning[]
  /** エラー一覧 */
  errors: ConversionError[]
}

/**
 * エクスポート設定
 * Export configuration
 */
export interface ExportConfig {
  /** 出力形式 */
  format: 'pdf' | 'excel' | 'csv' | 'json'
  /** 仕訳を含める */
  includeJournals: boolean
  /** 財務諸表を含める */
  includeFinancialStatements: boolean
  /** 調整仕訳を含める */
  includeAdjustingEntries: boolean
  /** 開示注記を含める */
  includeDisclosures: boolean
  /** AI分析を含める */
  includeAIAnalysis: boolean
  /** 言語 */
  language: 'ja' | 'en' | 'both'
  /** 通貨表示 */
  currency: 'source' | 'target' | 'both'
}

/**
 * エクスポート結果
 * Export result
 */
export interface ExportResult {
  /** ID */
  id: string
  /** プロジェクトID */
  projectId: string
  /** 形式 */
  format: string
  /** ファイルURL */
  fileUrl?: string
  /** ファイル名 */
  fileName: string
  /** ファイルサイズ（バイト） */
  fileSize: number
  /** 生成日時 */
  generatedAt: Date
  /** 有効期限 */
  expiresAt?: Date
}

/**
 * 変換プロジェクト作成リクエスト
 * Create conversion project request
 */
export interface CreateConversionProjectRequest {
  /** プロジェクト名 */
  name: string
  /** 説明 */
  description?: string
  /** ターゲット会計基準 */
  targetStandard: 'USGAAP' | 'IFRS'
  /** ターゲットCOA ID */
  targetCoaId: string
  /** 期間開始日（ISO文字列） */
  periodStart: string
  /** 期間終了日（ISO文字列） */
  periodEnd: string
  /** 設定（部分） */
  settings: Partial<ConversionSettings>
}

/**
 * 変換実行リクエスト
 * Execute conversion request
 */
export interface ExecuteConversionRequest {
  /** プロジェクトID */
  projectId: string
  /** ドライラン（テスト実行）フラグ */
  dryRun?: boolean
}

/**
 * マッピング推論リクエスト
 * Mapping suggestion request
 */
export interface MappingSuggestionRequest {
  /** プロジェクトID */
  projectId: string
  /** ソース勘定科目コード一覧（省略時は全対象） */
  sourceAccountCodes?: string[]
}

/**
 * 変換プロジェクト一覧レスポンス
 * Conversion project list response
 */
export interface ConversionListResponse {
  /** データ */
  data: ConversionProject[]
  /** ページネーション情報 */
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type ReferenceType =
  | 'ASBJ_statement'
  | 'ASBJ_guidance'
  | 'JICPA_guideline'
  | 'ASC_topic'
  | 'ASC_subtopic'
  | 'ASC_section'
  | 'ASC_paragraph'
  | 'IFRS_standard'
  | 'IAS_standard'
  | 'IFRIC_interpretation'
  | 'SIC_interpretation'

export interface StandardReference {
  id: string
  standard: AccountingStandard
  referenceType: ReferenceType
  referenceNumber: string
  title: string
  titleEn?: string
  description?: string
  descriptionEn?: string
  effectiveDate?: Date
  supersededDate?: Date
  isActive: boolean
  officialUrl?: string
  keywords?: string[]
}

export type EntityType = 'mapping' | 'journal_conversion' | 'adjusting_entry' | 'fs_conversion'

export type RationaleType =
  | 'mapping_basis'
  | 'difference_explanation'
  | 'adjustment_reason'
  | 'disclosure_requirement'
  | 'measurement_change'
  | 'presentation_change'

export interface ConversionRationale {
  id: string
  projectId: string

  entityType: EntityType
  entityId: string

  rationaleType: RationaleType

  sourceReference?: StandardReference
  targetReference?: StandardReference

  summary: string
  summaryEn?: string
  detailedExplanation?: string
  detailedExplanationEn?: string

  impactAmount?: number
  impactDirection?: 'increase' | 'decrease' | 'reclassification'

  isAiGenerated: boolean
  aiModelUsed?: string
  aiConfidence?: number

  isReviewed: boolean
  reviewedBy?: string
  reviewedAt?: Date

  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface RationaleAuditEntry {
  id: string
  rationaleId: string
  action: 'create' | 'update' | 'review' | 'approve' | 'reject'
  previousValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  changedFields?: string[]
  userId?: string
  userName?: string
  userRole?: string
  ipAddress?: string
  userAgent?: string
  notes?: string
  createdAt: Date
}

export interface CreateRationaleInput {
  projectId: string
  entityType: EntityType
  entityId: string
  rationaleType: RationaleType
  sourceReferenceId?: string
  targetReferenceId?: string
  summary: string
  summaryEn?: string
  detailedExplanation?: string
  detailedExplanationEn?: string
  impactAmount?: number
  impactDirection?: 'increase' | 'decrease' | 'reclassification'
  isAiGenerated?: boolean
  aiModelUsed?: string
  aiConfidence?: number
  createdBy?: string
}

export interface UpdateRationaleInput {
  sourceReferenceId?: string
  targetReferenceId?: string
  summary?: string
  summaryEn?: string
  detailedExplanation?: string
  detailedExplanationEn?: string
  impactAmount?: number
  impactDirection?: 'increase' | 'decrease' | 'reclassification'
}

export interface RationaleFilters {
  entityType?: EntityType
  rationaleType?: RationaleType
  isReviewed?: boolean
  isAiGenerated?: boolean
}

export interface AuditReportSummary {
  totalRationales: number
  reviewedRationales: number
  aiGeneratedRationales: number
  pendingReview: number
}

export interface UnreviewedItem {
  entityType: EntityType
  entityId: string
  summary: string
  createdAt: Date
}

export interface SignificantImpact {
  entityType: EntityType
  entityId: string
  impactAmount: number
  summary: string
}

export interface StandardReferenceUsage {
  reference: StandardReference
  usageCount: number
}

export interface AuditReport {
  projectId: string
  projectName: string
  generatedAt: Date

  summary: AuditReportSummary

  byEntityType: Record<EntityType, number>
  byRationaleType: Record<RationaleType, number>

  unreviewedItems: UnreviewedItem[]
  significantImpacts: SignificantImpact[]
  standardReferences: StandardReferenceUsage[]
}

export interface GeneratedRationale {
  summary: string
  summaryEn: string
  detailedExplanation: string
  detailedExplanationEn: string
  sourceReferenceNumbers: string[]
  targetReferenceNumbers: string[]
  impactAmount?: number
  impactDirection?: 'increase' | 'decrease' | 'reclassification'
  confidence: number
}
