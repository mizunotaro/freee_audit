import { describe, it, expect } from 'vitest'
import { checkFinancialFacts, extractFinancialClaims } from '@/lib/ai/security/fact-checker'

describe('FactChecker', () => {
  describe('checkFinancialFacts', () => {
    it('should return error for empty input', () => {
      const result = checkFinancialFacts('')
      expect(result.success).toBe(false)
    })

    it('should return error for null input', () => {
      const result = checkFinancialFacts(null as any)
      expect(result.success).toBe(false)
    })

    it('should verify correct corporate tax rate', () => {
      const result = checkFinancialFacts('法人税率は23.2%です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.verified).toBe(true)
        expect(result.data.facts.some((f) => f.status === 'verified')).toBe(true)
      }
    })

    it('should dispute incorrect corporate tax rate (30%)', () => {
      const result = checkFinancialFacts('法人税率は約30%です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.facts.some((f) => f.status === 'disputed')).toBe(true)
      }
    })

    it('should verify correct consumption tax rate', () => {
      const result = checkFinancialFacts('消費税率は10%です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.facts.some((f) => f.status === 'verified')).toBe(true)
      }
    })

    it('should dispute incorrect consumption tax (8%)', () => {
      const result = checkFinancialFacts('消費税率は8%です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.facts.some((f) => f.status === 'disputed')).toBe(true)
      }
    })

    it('should verify depreciation methods', () => {
      const result = checkFinancialFacts('定率法と定額法の両方が使用可能です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.facts.some((f) => f.status === 'verified')).toBe(true)
      }
    })

    it('should return unverifiable for non-financial text', () => {
      const result = checkFinancialFacts('今日は天気が良いです。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.facts).toHaveLength(0)
        expect(result.data.verified).toBe(true)
      }
    })

    it('should reject oversized input', () => {
      const result = checkFinancialFacts('a'.repeat(200001))
      expect(result.success).toBe(false)
    })

    it('should calculate overall confidence', () => {
      const result = checkFinancialFacts('法人税率は23.2%で、消費税率は10%です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.overallConfidence).toBeGreaterThan(0)
        expect(result.data.overallConfidence).toBeLessThanOrEqual(1)
      }
    })

    it('should generate warnings for disputed facts', () => {
      const result = checkFinancialFacts('法人税率は約30%です。')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.warnings.length).toBeGreaterThan(0)
      }
    })
  })

  describe('extractFinancialClaims', () => {
    it('should extract monetary amounts', () => {
      const facts = extractFinancialClaims('売上高は1億円、利益は5,000万円です。')
      expect(facts.length).toBeGreaterThan(0)
      expect(facts.some((f) => f.category === 'accounting_rule')).toBe(true)
    })

    it('should extract percentage claims', () => {
      const facts = extractFinancialClaims('成長率は15%でした。')
      expect(facts.some((f) => f.category === 'financial_ratio')).toBe(true)
    })

    it('should extract tax-related terms', () => {
      const facts = extractFinancialClaims('法人税と消費税の計算が必要です。')
      expect(facts.some((f) => f.category === 'tax_rate')).toBe(true)
    })

    it('should extract depreciation terms', () => {
      const facts = extractFinancialClaims('減価償却の耐用年数は5年です。')
      expect(facts.some((f) => f.category === 'depreciation_rule')).toBe(true)
    })

    it('should return empty for non-financial text', () => {
      const facts = extractFinancialClaims('hello world')
      expect(facts).toHaveLength(0)
    })
  })
})
