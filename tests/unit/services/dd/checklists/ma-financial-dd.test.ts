import { describe, it, expect } from 'vitest'
import { MA_FINANCIAL_DD_CHECKLIST } from '@/services/dd/checklists/ma-financial-dd'

describe('MA_FINANCIAL_DD_CHECKLIST', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MA_FINANCIAL_DD_CHECKLIST)).toBe(true)
    expect(MA_FINANCIAL_DD_CHECKLIST.length).toBeGreaterThan(0)
  })

  it('every item has required fields', () => {
    for (const item of MA_FINANCIAL_DD_CHECKLIST) {
      expect(item.code).toBeTruthy()
      expect(item.category).toBeTruthy()
      expect(item.title).toBeTruthy()
      expect(item.description).toBeTruthy()
      expect(item.severity).toBeTruthy()
      expect(item.checkType).toBeTruthy()
      expect(Array.isArray(item.dataSource)).toBe(true)
      expect(Array.isArray(item.validationRules)).toBe(true)
      expect(Array.isArray(item.relatedStandards)).toBe(true)
      expect(item.guidance).toBeTruthy()
    }
  })

  it('contains expected code prefixes', () => {
    const codes = MA_FINANCIAL_DD_CHECKLIST.map((item) => item.code)
    expect(codes).toContain('MA-FIN-001')
    expect(codes).toContain('MA-FIN-002')
    expect(codes).toContain('MA-NORM-001')
    expect(codes).toContain('MA-WC-001')
    expect(codes).toContain('MA-SYN-001')
    expect(codes).toContain('MA-PPA-001')
    expect(codes).toContain('MA-TAX-001')
    expect(codes).toContain('MA-IC-001')
    expect(codes).toContain('MA-CONT-001')
    expect(codes).toContain('MA-SUB-001')
    expect(codes).toContain('MA-RP-001')
  })

  it('has unique codes', () => {
    const codes = MA_FINANCIAL_DD_CHECKLIST.map((item) => item.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('covers M&A-specific categories', () => {
    const categories = new Set(MA_FINANCIAL_DD_CHECKLIST.map((item) => item.category))
    expect(categories.has('REVENUE_RECOGNITION')).toBe(true)
    expect(categories.has('ACCOUNTS_RECEIVABLE')).toBe(true)
    expect(categories.has('INVENTORY')).toBe(true)
    expect(categories.has('TAX')).toBe(true)
    expect(categories.has('RELATED_PARTY')).toBe(true)
    expect(categories.has('INTERNAL_CONTROLS')).toBe(true)
    expect(categories.has('CONTINGENCIES')).toBe(true)
  })

  it('includes M&A-specific categories like PRO_FORMA, SYNERGIES, GOODWILL', () => {
    const categories = new Set(MA_FINANCIAL_DD_CHECKLIST.map((item) => item.category))
    expect(categories.has('PRO_FORMA')).toBe(true)
    expect(categories.has('SYNERGIES')).toBe(true)
    expect(categories.has('GOODWILL')).toBe(true)
    expect(categories.has('PURCHASE_PRICE_ALLOCATION')).toBe(true)
    expect(categories.has('WORKING_CAPITAL')).toBe(true)
  })

  it('severity values are valid', () => {
    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    for (const item of MA_FINANCIAL_DD_CHECKLIST) {
      expect(validSeverities).toContain(item.severity)
    }
  })

  it('checkType values are valid', () => {
    const validTypes = ['AUTOMATED', 'MANUAL', 'SEMI_AUTOMATED']
    for (const item of MA_FINANCIAL_DD_CHECKLIST) {
      expect(validTypes).toContain(item.checkType)
    }
  })

  it('CRITICAL items have aiCheckPrompt', () => {
    const criticalItems = MA_FINANCIAL_DD_CHECKLIST.filter((item) => item.severity === 'CRITICAL')
    for (const item of criticalItems) {
      expect(item.aiCheckPrompt).toBeTruthy()
    }
  })

  it('each item has at least one related standard', () => {
    for (const item of MA_FINANCIAL_DD_CHECKLIST) {
      expect(item.relatedStandards.length).toBeGreaterThan(0)
    }
  })

  it('is frozen (readonly)', () => {
    expect(
      Object.isFrozen(MA_FINANCIAL_DD_CHECKLIST) || Array.isArray(MA_FINANCIAL_DD_CHECKLIST)
    ).toBe(true)
  })

  it('contains expected item count (at least 15)', () => {
    expect(MA_FINANCIAL_DD_CHECKLIST.length).toBeGreaterThanOrEqual(15)
  })
})
