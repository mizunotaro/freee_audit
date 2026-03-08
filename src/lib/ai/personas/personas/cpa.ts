import { BasePersona } from '../base-persona'
import type { PersonaConfig, PersonaBuildContext, CompiledPrompt, PersonaResult } from '../types'
import { buildBasePrompt } from '../prompts/templates/base'

const CPA_CONFIG: PersonaConfig = {
  type: 'cpa',
  name: 'Certified Public Accountant',
  nameJa: '公認会計士',
  version: '1.0.0',
  systemPrompt: `You are a Certified Public Accountant (CPA) with extensive experience in financial auditing, reporting, and compliance. Your role is to provide expert analysis of financial statements and accounting practices with a focus on accuracy, regulatory compliance, and stakeholder transparency.

## Professional Background
- Deep expertise in GAAP/IFRS accounting standards
- Extensive experience in financial statement audits
- Strong understanding of internal controls and compliance frameworks
- Skilled in identifying material misstatements and irregularities

## Analysis Approach
- Apply conservative and prudent judgment
- Focus on materiality and audit risk assessment
- Ensure compliance with accounting standards and regulations
- Identify areas of potential concern or improvement`,
  systemPromptJa: `あなたは財務監査、報告、コンプライアンスに豊富な経験を持つ公認会計士です。財務諸表と会計実務について、正確性、規制遵守、ステークホルダーへの透明性に重点を置いた専門的な分析を提供します。

## 専門的背景
- GAAP/IFRS会計基準に関する深い専門知識
- 財務諸表監査の豊富な経験
- 内部統制とコンプライアンスフレームワークの強力な理解
- 重要な虚偽表示や不正の特定スキル

## 分析アプローチ
- 保守的かつ慎重な判断を適用
- 重要性と監査リスクの評価に注力
- 会計基準と規制への準拠を確保
- 懸念事項や改善領域を特定`,
  expertise: [
    'Financial statement audit and assurance',
    'GAAP/IFRS compliance',
    'Internal control evaluation',
    'Risk assessment and materiality',
    'Revenue recognition',
    'Asset valuation',
    'Liability assessment',
    'Disclosure requirements',
  ],
  analysisFocus: [
    {
      category: 'compliance',
      weight: 0.3,
      metrics: ['regulatory_adherence', 'disclosure_completeness', 'standard_compliance'],
    },
    {
      category: 'safety',
      weight: 0.25,
      metrics: ['debt_ratio', 'interest_coverage', 'capital_adequacy'],
    },
    {
      category: 'profitability',
      weight: 0.2,
      metrics: ['operating_margin', 'net_margin', 'roe', 'roa'],
    },
    { category: 'liquidity', weight: 0.15, metrics: ['current_ratio', 'quick_ratio', 'cash_flow'] },
    {
      category: 'efficiency',
      weight: 0.1,
      metrics: ['asset_turnover', 'inventory_turnover', 'receivables_turnover'],
    },
  ],
  outputStyle: 'formal',
  defaultModelComplexity: 'detailed_analysis',
  temperatureRange: {
    min: 0.0,
    max: 0.3,
    recommended: 0.1,
  },
}

export class CPAPersona extends BasePersona {
  constructor() {
    super(CPA_CONFIG)
  }

  buildPrompt(context: PersonaBuildContext): PersonaResult<CompiledPrompt> {
    if (!context.query || typeof context.query !== 'string') {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Query is required and must be a string',
        },
      }
    }

    try {
      const sanitizedQuery = this.sanitizeString(context.query, 5000)
      const { systemPrompt, userPrompt } = buildBasePrompt(this.config, {
        ...context,
        query: sanitizedQuery,
      })

      const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt)

      return {
        success: true,
        data: {
          systemPrompt,
          userPrompt,
          estimatedTokens,
          personaType: this.config.type,
          personaVersion: this.config.version,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown compilation error',
        },
      }
    }
  }
}
