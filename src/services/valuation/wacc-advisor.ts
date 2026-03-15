import type {
  WACCAdviceRequest,
  WACCAdviceResponse,
  WACCAdviceItem,
  CalculationStep,
  Result,
  ValuationError,
  INDUSTRY_DEFAULTS as _INDUSTRY_DEFAULTS,
} from './types'

const _VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

const INDUSTRY_DATA: Record<
  string,
  {
    unleveredBeta: { min: number; max: number; default: number }
    debtEquityRatio: { min: number; max: number; default: number }
    creditSpread: number
  }
> = {
  software: {
    unleveredBeta: { min: 1.0, max: 1.5, default: 1.2 },
    debtEquityRatio: { min: 0.1, max: 0.4, default: 0.2 },
    creditSpread: 1.5,
  },
  saas: {
    unleveredBeta: { min: 1.1, max: 1.6, default: 1.3 },
    debtEquityRatio: { min: 0.05, max: 0.3, default: 0.15 },
    creditSpread: 1.8,
  },
  manufacturing: {
    unleveredBeta: { min: 0.8, max: 1.2, default: 1.0 },
    debtEquityRatio: { min: 0.3, max: 0.8, default: 0.5 },
    creditSpread: 1.2,
  },
  retail: {
    unleveredBeta: { min: 0.7, max: 1.1, default: 0.9 },
    debtEquityRatio: { min: 0.2, max: 0.6, default: 0.4 },
    creditSpread: 1.3,
  },
  financial: {
    unleveredBeta: { min: 0.6, max: 1.0, default: 0.8 },
    debtEquityRatio: { min: 1.0, max: 3.0, default: 2.0 },
    creditSpread: 0.8,
  },
  healthcare: {
    unleveredBeta: { min: 0.9, max: 1.3, default: 1.1 },
    debtEquityRatio: { min: 0.2, max: 0.5, default: 0.3 },
    creditSpread: 1.0,
  },
  energy: {
    unleveredBeta: { min: 0.8, max: 1.2, default: 1.0 },
    debtEquityRatio: { min: 0.3, max: 0.7, default: 0.5 },
    creditSpread: 1.5,
  },
  real_estate: {
    unleveredBeta: { min: 0.6, max: 0.9, default: 0.7 },
    debtEquityRatio: { min: 0.5, max: 1.5, default: 0.8 },
    creditSpread: 1.2,
  },
  default: {
    unleveredBeta: { min: 0.8, max: 1.3, default: 1.0 },
    debtEquityRatio: { min: 0.2, max: 0.8, default: 0.4 },
    creditSpread: 1.5,
  },
}

const JAPAN_MARKET_DATA = {
  riskFreeRate: {
    current: 0.8,
    range: { min: 0.5, max: 1.2 },
    source: 'BOJ 10-year JGB yield',
  },
  marketRiskPremium: {
    current: 6.0,
    range: { min: 5.0, max: 7.0 },
    source: 'Damodaran (2024), Ibbotson',
  },
  statutoryTaxRate: 30.62,
}

function normalizeIndustry(industry: string): string {
  const normalized = industry.toLowerCase().replace(/[-\s]/g, '_')

  const mappings: Record<string, string> = {
    情報通信: 'software',
    software: 'software',
    it: 'software',
    tech: 'software',
    製造: 'manufacturing',
    manufacturing: 'manufacturing',
    小売: 'retail',
    retail: 'retail',
    金融: 'financial',
    financial: 'financial',
    finance: 'financial',
    医療: 'healthcare',
    healthcare: 'healthcare',
    pharma: 'healthcare',
    エネルギー: 'energy',
    energy: 'energy',
    不動産: 'real_estate',
    real_estate: 'real_estate',
    saas: 'saas',
    cloud: 'saas',
  }

  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key.toLowerCase())) {
      return value
    }
  }

  return 'default'
}

function calculateLeveredBeta(
  unleveredBeta: number,
  debtEquityRatio: number,
  taxRate: number
): number {
  return unleveredBeta * (1 + (1 - taxRate) * debtEquityRatio)
}

export function getWACCAdvice(request: WACCAdviceRequest): Result<WACCAdviceResponse> {
  const {
    industry,
    subIndustry: _subIndustry,
    companySize = 'mid',
    hasRating = false,
    debtEquityRatio,
    taxRate,
  } = request

  if (!industry || industry.trim() === '') {
    return {
      success: false,
      error: createError('invalid_input', 'Industry is required'),
    }
  }

  try {
    const normalizedIndustry = normalizeIndustry(industry)
    const industryData = INDUSTRY_DATA[normalizedIndustry] || INDUSTRY_DATA.default

    const sizePremium = companySize === 'small' ? 0.5 : companySize === 'large' ? -0.2 : 0
    const ratingAdjustment = hasRating ? -0.3 : 0

    const riskFreeRate: WACCAdviceItem = {
      suggested: JAPAN_MARKET_DATA.riskFreeRate.current,
      range: JAPAN_MARKET_DATA.riskFreeRate.range,
      rationale: `日本10年国債利回りを基準とします。YCC政策終了後、長期金利は${JAPAN_MARKET_DATA.riskFreeRate.range.min}%〜${JAPAN_MARKET_DATA.riskFreeRate.range.max}%程度で推移しています。`,
      dataSource: JAPAN_MARKET_DATA.riskFreeRate.source,
    }

    const marketRiskPremium: WACCAdviceItem = {
      suggested: JAPAN_MARKET_DATA.marketRiskPremium.current + sizePremium,
      range: {
        min: JAPAN_MARKET_DATA.marketRiskPremium.range.min + sizePremium,
        max: JAPAN_MARKET_DATA.marketRiskPremium.range.max + sizePremium,
      },
      rationale: `日本市場の株式リスクプレミアムは${JAPAN_MARKET_DATA.marketRiskPremium.range.min}%〜${JAPAN_MARKET_DATA.marketRiskPremium.range.max}%（Damodaran 2024）。${companySize === 'small' ? '中小企業のためサイズプレミアム+0.5%を上乗せ' : companySize === 'large' ? '大型企業のため-0.2%調整' : '標準的なプレミアムを適用'}。`,
      dataSource: JAPAN_MARKET_DATA.marketRiskPremium.source,
    }

    const effectiveDERatio = debtEquityRatio ?? industryData.debtEquityRatio.default
    const effectiveTaxRate = (taxRate ?? JAPAN_MARKET_DATA.statutoryTaxRate) / 100

    const unleveredBeta = industryData.unleveredBeta.default
    const leveredBeta = calculateLeveredBeta(unleveredBeta, effectiveDERatio, effectiveTaxRate)

    const beta: WACCAdviceResponse['beta'] = {
      suggested: leveredBeta,
      range: {
        min: calculateLeveredBeta(
          industryData.unleveredBeta.min,
          effectiveDERatio,
          effectiveTaxRate
        ),
        max: calculateLeveredBeta(
          industryData.unleveredBeta.max,
          effectiveDERatio,
          effectiveTaxRate
        ),
      },
      rationale: `業界（${normalizedIndustry}）のアンレバードβ: ${industryData.unleveredBeta.default}。D/E比率${effectiveDERatio.toFixed(2)}を考慮しレバードβ: ${leveredBeta.toFixed(2)}を推奨。`,
      dataSource: 'Industry beta data, Damodaran',
      unleveredBeta,
      suggestedLeveredBeta: leveredBeta,
      comparableCompanies: getComparableCompanies(normalizedIndustry),
    }

    const baseRate =
      JAPAN_MARKET_DATA.riskFreeRate.current + industryData.creditSpread + ratingAdjustment
    const costOfDebt: WACCAdviceResponse['costOfDebt'] = {
      suggested: baseRate,
      range: {
        min: baseRate - 0.5,
        max: baseRate + 1.0,
      },
      rationale: `リスクフリーレート + 信用スプレッド（${industryData.creditSpread}%）${hasRating ? ' + 格付ありで-0.3%調整' : ''}。実際の借入利率をご確認ください。`,
      dataSource: 'Market credit spreads, company rating',
      spreadOverRiskFree: industryData.creditSpread + ratingAdjustment,
    }

    const taxRateAdvice: WACCAdviceResponse['taxRate'] = {
      suggested: taxRate ?? JAPAN_MARKET_DATA.statutoryTaxRate,
      range: { min: 25, max: 35 },
      rationale: taxRate
        ? `実効税率${taxRate}%を使用。法定実効税率は${JAPAN_MARKET_DATA.statutoryTaxRate}%です。`
        : `法定実効税率${JAPAN_MARKET_DATA.statutoryTaxRate}%を推奨。実効税率が判明している場合はそちらを使用してください。`,
      dataSource: 'Japanese Corporate Tax Law',
      statutory: JAPAN_MARKET_DATA.statutoryTaxRate,
    }

    const optimalCapitalStructure = {
      suggestedDERatio: industryData.debtEquityRatio.default,
      industryAverage: industryData.debtEquityRatio.default,
      rationale: `${normalizedIndustry}業界の平均D/E比率は${(industryData.debtEquityRatio.default * 100).toFixed(0)}%程度。最適資本構造は企業のキャッシュフロー安定性によって異なります。`,
    }

    const confidence = determineConfidence(
      normalizedIndustry,
      hasRating,
      debtEquityRatio !== undefined
    )

    const response: WACCAdviceResponse = {
      riskFreeRate,
      marketRiskPremium,
      beta,
      costOfDebt,
      taxRate: taxRateAdvice,
      optimalCapitalStructure,
      confidence,
      lastUpdated: new Date().toISOString(),
    }

    return { success: true, data: response }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'advice_error',
        error instanceof Error ? error.message : 'Failed to generate WACC advice'
      ),
    }
  }
}

function getComparableCompanies(industry: string): string[] {
  const companies: Record<string, string[]> = {
    software: ['楽天グループ', 'ヤフー', 'サイボウズ'],
    saas: ['freee', 'SmartHR', 'Sansan'],
    manufacturing: ['トヨタ自動車', '本田技研工業', 'ソニーグループ'],
    retail: ['セブン&アイ', 'イオン', 'ユニクロ'],
    financial: ['三菱UFJ', 'みずほ', '三井住友'],
    healthcare: ['武田薬品工業', 'アステラス製薬', 'エーザイ'],
    energy: ['ENEOS', '出光興産', '東京電力'],
    real_estate: ['三井不動産', '三菱地所', '森ビル'],
    default: ['トヨタ自動車', 'ソニーグループ', '楽天グループ'],
  }

  return companies[industry] || companies.default
}

function determineConfidence(
  industry: string,
  hasRating: boolean,
  hasDERatio: boolean
): 'high' | 'medium' | 'low' {
  let score = 0

  if (industry !== 'default') score += 2
  if (hasRating) score += 2
  if (hasDERatio) score += 1

  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

export function formatWACCAdvice(advice: WACCAdviceResponse): CalculationStep[] {
  return [
    {
      id: `wacc_advice_${Date.now()}_1`,
      name: 'Risk-Free Rate',
      description: advice.riskFreeRate.rationale,
      formula: 'Rf',
      formulaWithValues: `推奨値: ${advice.riskFreeRate.suggested}% (${advice.riskFreeRate.range.min}% - ${advice.riskFreeRate.range.max}%)`,
      inputs: { suggested: advice.riskFreeRate.suggested },
      output: advice.riskFreeRate.suggested,
      unit: 'percent',
    },
    {
      id: `wacc_advice_${Date.now()}_2`,
      name: 'Market Risk Premium',
      description: advice.marketRiskPremium.rationale,
      formula: 'Rm - Rf',
      formulaWithValues: `推奨値: ${advice.marketRiskPremium.suggested}% (${advice.marketRiskPremium.range.min}% - ${advice.marketRiskPremium.range.max}%)`,
      inputs: { suggested: advice.marketRiskPremium.suggested },
      output: advice.marketRiskPremium.suggested,
      unit: 'percent',
    },
    {
      id: `wacc_advice_${Date.now()}_3`,
      name: 'Beta (β)',
      description: advice.beta.rationale,
      formula: 'β = βU × (1 + (1-Tc) × D/E)',
      formulaWithValues: `推奨値: ${advice.beta.suggested.toFixed(2)} (${advice.beta.range.min.toFixed(2)} - ${advice.beta.range.max.toFixed(2)})`,
      inputs: { unlevered: advice.beta.unleveredBeta, levered: advice.beta.suggestedLeveredBeta },
      output: advice.beta.suggested,
      unit: 'decimal',
    },
    {
      id: `wacc_advice_${Date.now()}_4`,
      name: 'Cost of Debt',
      description: advice.costOfDebt.rationale,
      formula: 'Rd = Rf + Credit Spread',
      formulaWithValues: `推奨値: ${advice.costOfDebt.suggested}% (${advice.costOfDebt.range.min}% - ${advice.costOfDebt.range.max}%)`,
      inputs: { suggested: advice.costOfDebt.suggested },
      output: advice.costOfDebt.suggested,
      unit: 'percent',
    },
    {
      id: `wacc_advice_${Date.now()}_5`,
      name: 'Tax Rate',
      description: advice.taxRate.rationale,
      formula: 'Tc',
      formulaWithValues: `推奨値: ${advice.taxRate.suggested}% (法定: ${advice.taxRate.statutory}%)`,
      inputs: { suggested: advice.taxRate.suggested },
      output: advice.taxRate.suggested,
      unit: 'percent',
    },
  ]
}
