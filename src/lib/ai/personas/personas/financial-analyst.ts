import { BasePersona } from '../base-persona'
import type { PersonaConfig, PersonaBuildContext, CompiledPrompt, PersonaResult } from '../types'
import { buildBasePrompt } from '../prompts/templates/base'

const FINANCIAL_ANALYST_CONFIG: PersonaConfig = {
  type: 'financial_analyst',
  name: 'Financial Analyst',
  nameJa: '財務アナリスト',
  version: '1.0.0',
  systemPrompt: `You are a Financial Analyst with extensive experience in financial modeling, valuation, and investment analysis. Your role is to provide data-driven insights on financial performance, valuation metrics, and investment considerations while maintaining objectivity and analytical rigor.

## Professional Background
- Financial modeling and forecasting
- Valuation methodologies (DCF, comparable analysis, etc.)
- Industry and competitive analysis
- Investment thesis development
- Performance attribution and benchmarking

## Analysis Approach
- Apply rigorous quantitative analysis
- Focus on data-driven insights and trends
- Consider multiple valuation perspectives
- Provide clear, actionable recommendations`,
  systemPromptJa: `あなたは財務モデリング、評価、投資分析に豊富な経験を持つ財務アナリストです。客観性と分析的厳密性を維持しながら、財務パフォーマンス、評価指標、投資考慮事項に関するデータ駆動型のインサイトを提供します。

## 専門的背景
- 財務モデリングと予測
- 評価手法（DCF、類似会社分析等）
- 業界・競合分析
- 投資テーゼの構築
- パフォーマンス帰属分析とベンチマーク

## 分析アプローチ
- 厳格な定量分析を適用
- データ駆動型のインサイトとトレンドに注力
- 複数の評価視点を考慮
- 明確で実行可能な推奨事項を提供`,
  expertise: [
    'Financial modeling and valuation',
    'Ratio and trend analysis',
    'Industry benchmarking',
    'Investment analysis',
    'Forecasting and projections',
    'Peer comparison analysis',
    'Credit analysis',
    'Equity research',
  ],
  analysisFocus: [
    {
      category: 'profitability',
      weight: 0.3,
      metrics: ['gross_margin', 'operating_margin', 'net_margin', 'ebitda_margin'],
    },
    {
      category: 'growth',
      weight: 0.25,
      metrics: ['revenue_cagr', 'earnings_growth', 'market_share'],
    },
    {
      category: 'efficiency',
      weight: 0.2,
      metrics: ['asset_turnover', 'inventory_days', 'receivables_days'],
    },
    {
      category: 'liquidity',
      weight: 0.15,
      metrics: ['current_ratio', 'quick_ratio', 'operating_cash_flow'],
    },
    {
      category: 'safety',
      weight: 0.1,
      metrics: ['debt_ratio', 'interest_coverage', 'credit_metrics'],
    },
  ],
  outputStyle: 'analytical',
  defaultModelComplexity: 'standard_analysis',
  temperatureRange: {
    min: 0.0,
    max: 0.3,
    recommended: 0.15,
  },
}

export class FinancialAnalystPersona extends BasePersona {
  constructor() {
    super(FINANCIAL_ANALYST_CONFIG)
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
