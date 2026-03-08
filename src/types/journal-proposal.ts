import { z } from 'zod'

// ============================================
// 基本型
// ============================================

export type Result<T, E = JournalProposalError> =
  | { success: true; data: T }
  | { success: false; error: E }

export interface JournalProposalError {
  code: JournalProposalErrorCode
  message: string
  details?: Record<string, unknown>
}

export type JournalProposalErrorCode =
  | 'DOCUMENT_NOT_FOUND'
  | 'OCR_FAILED'
  | 'INVALID_INPUT'
  | 'ANALYSIS_FAILED'
  | 'PROPOSAL_GENERATION_FAILED'
  | 'UNAUTHORIZED'

// ============================================
// 入力型
// ============================================

export interface JournalProposalInput {
  documentId: string
  companyId: string
  userId: string
  userContext: string
  fiscalYear?: number
}

export const JournalProposalInputSchema = z.object({
  documentId: z.string().min(1),
  companyId: z.string().min(1),
  userId: z.string().min(1),
  userContext: z.string().min(1).max(2000),
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
})

// ============================================
// 出力型
// ============================================

export interface JournalProposalOutput {
  documentId: string
  ocrResult: OCRAnalysisResult
  proposals: JournalProposal[]
  generatedAt: Date
  aiProvider: string
  aiModel: string
}

export interface OCRAnalysisResult {
  rawText: string
  extractedInfo: ExtractedReceiptInfo
  confidence: number
  warnings: string[]
}

export interface ExtractedReceiptInfo {
  date?: string
  vendorName?: string
  totalAmount?: number
  taxAmount?: number
  taxRate?: number
  items?: ReceiptItem[]
  paymentMethod?: string
}

export interface ReceiptItem {
  name: string
  quantity?: number
  unitPrice?: number
  amount?: number
}

// ============================================
// 仕訳提案
// ============================================

export interface JournalProposal {
  id: string
  rank: 1 | 2 | 3
  confidence: number
  entries: JournalEntryProposal[]
  reasoning: ProposalReasoning
  riskAssessment: RiskAssessment
}

export interface JournalEntryProposal {
  id: string
  lineType: 'debit' | 'credit'
  accountCode: string
  accountName: string
  subAccount?: string
  departmentCode?: string
  amount: number
  taxType: TaxType
  taxRate: number
  taxAmount: number
  description: string
  entryDate: string
  referenceNumber?: string
}

export type TaxType =
  | 'taxable_10' // 課税10%
  | 'taxable_8' // 課税8%
  | 'taxable_reduced_8' // 軽減税率8%
  | 'tax_exempt' // 非課税
  | 'non_taxable' // 不課税
  | 'zero_tax' // 免税

export interface ProposalReasoning {
  accountSelection: string
  taxClassification: string
  standardCompliance: string
  keyAssumptions: string[]
  references?: LegalReference[]
}

export interface LegalReference {
  type: 'accounting_standard' | 'tax_law' | 'guideline'
  name: string
  article?: string
  description: string
}

// ============================================
// リスク評価
// ============================================

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high'
  auditRisk: RiskEvaluation
  taxRisk: RiskEvaluation
  recommendations: string[]
}

export interface RiskEvaluation {
  level: 'low' | 'medium' | 'high'
  score: number // 0-100
  factors: RiskFactor[]
}

export interface RiskFactor {
  category: string
  description: string
  severity: 'info' | 'warning' | 'error'
  suggestion?: string
}

// ============================================
// Zodスキーマ
// ============================================

export const JournalEntryProposalSchema = z.object({
  id: z.string(),
  lineType: z.enum(['debit', 'credit']),
  accountCode: z.string(),
  accountName: z.string(),
  subAccount: z.string().optional(),
  departmentCode: z.string().optional(),
  amount: z.number().nonnegative(),
  taxType: z.enum([
    'taxable_10',
    'taxable_8',
    'taxable_reduced_8',
    'tax_exempt',
    'non_taxable',
    'zero_tax',
  ]),
  taxRate: z.number().min(0).max(1),
  taxAmount: z.number().nonnegative(),
  description: z.string(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenceNumber: z.string().optional(),
})

export const JournalProposalSchema = z.object({
  id: z.string(),
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  confidence: z.number().min(0).max(1),
  entries: z.array(JournalEntryProposalSchema).min(2),
  reasoning: z.object({
    accountSelection: z.string(),
    taxClassification: z.string(),
    standardCompliance: z.string(),
    keyAssumptions: z.array(z.string()),
    references: z
      .array(
        z.object({
          type: z.enum(['accounting_standard', 'tax_law', 'guideline']),
          name: z.string(),
          article: z.string().optional(),
          description: z.string(),
        })
      )
      .optional(),
  }),
  riskAssessment: z.object({
    overallRisk: z.enum(['low', 'medium', 'high']),
    auditRisk: z.object({
      level: z.enum(['low', 'medium', 'high']),
      score: z.number().min(0).max(100),
      factors: z.array(
        z.object({
          category: z.string(),
          description: z.string(),
          severity: z.enum(['info', 'warning', 'error']),
          suggestion: z.string().optional(),
        })
      ),
    }),
    taxRisk: z.object({
      level: z.enum(['low', 'medium', 'high']),
      score: z.number().min(0).max(100),
      factors: z.array(
        z.object({
          category: z.string(),
          description: z.string(),
          severity: z.enum(['info', 'warning', 'error']),
          suggestion: z.string().optional(),
        })
      ),
    }),
    recommendations: z.array(z.string()),
  }),
})

export const JournalProposalOutputSchema = z.object({
  documentId: z.string(),
  ocrResult: z.object({
    rawText: z.string(),
    extractedInfo: z.object({
      date: z.string().optional(),
      vendorName: z.string().optional(),
      totalAmount: z.number().optional(),
      taxAmount: z.number().optional(),
      taxRate: z.number().optional(),
      items: z
        .array(
          z.object({
            name: z.string(),
            quantity: z.number().optional(),
            unitPrice: z.number().optional(),
            amount: z.number().optional(),
          })
        )
        .optional(),
      paymentMethod: z.string().optional(),
    }),
    confidence: z.number(),
    warnings: z.array(z.string()),
  }),
  proposals: z.array(JournalProposalSchema).min(1).max(3),
  generatedAt: z.date(),
  aiProvider: z.string(),
  aiModel: z.string(),
})

// ============================================
// デフォルト値
// ============================================

export const DEFAULT_TAX_RATES: Record<TaxType, number> = {
  taxable_10: 0.1,
  taxable_8: 0.08,
  taxable_reduced_8: 0.08,
  tax_exempt: 0,
  non_taxable: 0,
  zero_tax: 0,
}

export const JAPANESE_GAAP_REFERENCES: LegalReference[] = [
  {
    type: 'accounting_standard',
    name: '企業会計原則',
    article: '第二 貸借対照表原則',
    description: '資産、負債及び資本の貸借対照表価値',
  },
  {
    type: 'accounting_standard',
    name: '収益費用の期間帰属原則',
    description: '発生主義に基づく収益・費用の認識',
  },
  {
    type: 'tax_law',
    name: '法人税法',
    article: '第22条',
    description: '益金及び損金の額',
  },
  {
    type: 'tax_law',
    name: '消費税法',
    article: '第30条',
    description: '課税仕入れ等の税額の控除',
  },
]
