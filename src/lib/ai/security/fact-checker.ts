import { Result, createAppError } from '@/types/result'

const VERSION = '1.0.0'

export interface FinancialFact {
  claim: string
  category: FactCategory
  source?: string
  confidence: number
}

export type FactCategory =
  | 'accounting_rule'
  | 'tax_rate'
  | 'depreciation_rule'
  | 'financial_ratio'
  | 'compliance_deadline'
  | 'j_gaap_standard'
  | 'ifrs_standard'
  | 'corporate_tax'
  | 'consumption_tax'
  | 'social_insurance'

export interface FactCheckResult {
  verified: boolean
  facts: CheckedFact[]
  overallConfidence: number
  warnings: string[]
}

export interface CheckedFact {
  claim: string
  category: FactCategory
  status: 'verified' | 'disputed' | 'unverifiable' | 'outdated'
  confidence: number
  note?: string
}

interface KnownFact {
  category: FactCategory
  pattern: RegExp
  expectedValue: string | number | boolean
  description: string
  effectiveFrom?: string
  effectiveTo?: string
}

const KNOWN_FACTS: KnownFact[] = [
  {
    category: 'corporate_tax',
    pattern: /法人税率\s*(?:は\s*)?(\d+(?:\.\d+)?)\s*%/,
    expectedValue: 23.2,
    description:
      'Standard corporate tax rate in Japan (national + local) is approximately 23.2% for companies with capital > 100M JPY',
    effectiveFrom: '2019-04-01',
  },
  {
    category: 'corporate_tax',
    pattern: /法人税率\s*(?:は\s*)?約?\s*30\s*%/,
    expectedValue: false,
    description:
      'Corporate tax rate is NOT 30%. Effective rate including local taxes is ~23.2% for standard companies.',
    effectiveFrom: '2019-04-01',
  },
  {
    category: 'consumption_tax',
    pattern: /消費税率\s*(?:は\s*)?(\d+)\s*%/,
    expectedValue: 10,
    description: 'Japanese consumption tax rate is 10% (8% for reduced rate items)',
    effectiveFrom: '2019-10-01',
  },
  {
    category: 'consumption_tax',
    pattern: /消費税率\s*(?:は\s*)?\s*8\s*%/,
    expectedValue: false,
    description:
      'Standard consumption tax is 10% since Oct 2019. 8% applies only to reduced rate items (food, newspapers).',
    effectiveFrom: '2019-10-01',
  },
  {
    category: 'depreciation_rule',
    pattern: /定率法/,
    expectedValue: true,
    description: 'Declining balance method is allowed for corporate tax purposes in Japan',
  },
  {
    category: 'depreciation_rule',
    pattern: /定額法/,
    expectedValue: true,
    description: 'Straight-line method is allowed for corporate tax purposes in Japan',
  },
  {
    category: 'social_insurance',
    pattern: /社会保険料\s*(?:の\s*)?(?:労働者|従業員)\s*負担\s*(?:は\s*)?約?\s*(\d+)\s*%/,
    expectedValue: 15,
    description: 'Employee social insurance burden is approximately 15% of gross salary',
  },
  {
    category: 'financial_ratio',
    pattern: /(?:自己資本比率|equity\s*ratio)\s*(?:は\s*)?(\d+)\s*%/,
    expectedValue: true,
    description:
      'Equity ratio is a valid financial metric; check if the specific percentage is reasonable for the industry',
  },
  {
    category: 'accounting_rule',
    pattern: /収益認識.*?(?:IFRS?|国際会計基準)/,
    expectedValue: true,
    description: 'Revenue recognition under IFRS 15 applies to IFRS-reporting companies',
  },
  {
    category: 'j_gaap_standard',
    pattern: /日本.*?会計基準.*?(?:適用|適格)/,
    expectedValue: true,
    description: 'Japanese GAAP is the standard accounting framework for Japanese companies',
  },
  {
    category: 'compliance_deadline',
    pattern: /確定申告.*?(?:期限|締め切り|deadline)\s*(?:は\s*)?(\d+)月/,
    expectedValue: 2,
    description:
      'Corporate tax return filing deadline is typically end of February (2 months after fiscal year end)',
  },
  {
    category: 'depreciation_rule',
    pattern: /減価償却.*?耐用年数.*?(\d+)\s*年/,
    expectedValue: true,
    description:
      'Useful life for depreciation depends on asset category per Japanese tax regulations',
  },
]

function _extractNumericalValue(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

function checkFactAgainstKnown(claim: string): CheckedFact[] {
  const results: CheckedFact[] = []

  for (const knownFact of KNOWN_FACTS) {
    const match = knownFact.pattern.exec(claim)
    if (!match) continue

    if (typeof knownFact.expectedValue === 'boolean') {
      results.push({
        claim,
        category: knownFact.category,
        status: knownFact.expectedValue ? 'verified' : 'disputed',
        confidence: 0.85,
        note: knownFact.description,
      })
    } else if (typeof knownFact.expectedValue === 'number') {
      if (match[1]) {
        const claimedValue = parseFloat(match[1])
        const tolerance = knownFact.expectedValue * 0.05

        if (Math.abs(claimedValue - knownFact.expectedValue) <= tolerance) {
          results.push({
            claim,
            category: knownFact.category,
            status: 'verified',
            confidence: 0.9,
            note: knownFact.description,
          })
        } else {
          results.push({
            claim,
            category: knownFact.category,
            status: 'disputed',
            confidence: 0.9,
            note: `Claimed value ${claimedValue} differs from expected ~${knownFact.expectedValue}. ${knownFact.description}`,
          })
        }
      } else {
        results.push({
          claim,
          category: knownFact.category,
          status: 'unverifiable',
          confidence: 0.5,
          note: knownFact.description,
        })
      }
    }
  }

  return results
}

function calculateOverallConfidence(facts: CheckedFact[]): number {
  if (facts.length === 0) return 0.5

  const totalConfidence = facts.reduce((sum, f) => sum + f.confidence, 0)
  return Math.round((totalConfidence / facts.length) * 100) / 100
}

export function checkFinancialFacts(text: string): Result<FactCheckResult> {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      error: createAppError('VALIDATION_ERROR', 'Input text is required for fact checking'),
    }
  }

  if (text.length > 200000) {
    return {
      success: false,
      error: createAppError(
        'VALIDATION_ERROR',
        'Input text exceeds maximum length of 200000 characters'
      ),
    }
  }

  const sentences = text
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 5)

  const allChecked: CheckedFact[] = []
  const warnings: string[] = []

  for (const sentence of sentences) {
    const checked = checkFactAgainstKnown(sentence)
    allChecked.push(...checked)
  }

  if (allChecked.some((f) => f.status === 'disputed')) {
    warnings.push(
      'One or more financial claims appear to conflict with known standards. Verify with authoritative sources.'
    )
  }

  if (allChecked.some((f) => f.status === 'unverifiable')) {
    warnings.push('Some claims could not be automatically verified. Manual review recommended.')
  }

  const verified = !allChecked.some((f) => f.status === 'disputed')
  const overallConfidence = calculateOverallConfidence(allChecked)

  return {
    success: true,
    data: {
      verified,
      facts: allChecked,
      overallConfidence,
      warnings,
    },
  }
}

export function extractFinancialClaims(text: string): FinancialFact[] {
  const financialPatterns = [
    {
      pattern: /[\d,]+(?:\.\d+)?\s*(?:円|万円|百万円|億円|兆円)/g,
      category: 'accounting_rule' as FactCategory,
    },
    { pattern: /(?:\d+(?:\.\d+)?)\s*%/g, category: 'financial_ratio' as FactCategory },
    {
      pattern: /(?:法人税|消費税|所得税|住民税|社会保険|厚生年金|健康保険)/g,
      category: 'tax_rate' as FactCategory,
    },
    {
      pattern: /(?:減価償却|耐用年数|残存価値|取得価額)/g,
      category: 'depreciation_rule' as FactCategory,
    },
  ]

  const facts: FinancialFact[] = []

  for (const { pattern, category } of financialPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const surrounding = text.slice(
        Math.max(0, match.index - 50),
        match.index + match[0].length + 50
      )
      facts.push({
        claim: surrounding.trim(),
        category,
        confidence: 0.5,
      })
    }
  }

  return facts
}

export { VERSION, KNOWN_FACTS }
