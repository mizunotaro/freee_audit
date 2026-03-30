import { describe, it, expect } from 'vitest'
import { IPO_SHORT_REVIEW_CHECKLIST } from '@/services/dd/checklists/ipo-short-review'
import type { DDChecklistItemDefinition } from '@/services/dd/types'

describe('IPO_SHORT_REVIEW_CHECKLIST', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(IPO_SHORT_REVIEW_CHECKLIST)).toBe(true)
    expect(IPO_SHORT_REVIEW_CHECKLIST.length).toBeGreaterThan(0)
  })

  it('every item has required fields', () => {
    for (const item of IPO_SHORT_REVIEW_CHECKLIST) {
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
    const codes = IPO_SHORT_REVIEW_CHECKLIST.map((item) => item.code)
    expect(codes).toContain('REV-001')
    expect(codes).toContain('AR-001')
    expect(codes).toContain('INV-001')
    expect(codes).toContain('FA-001')
    expect(codes).toContain('TAX-001')
    expect(codes).toContain('RP-001')
    expect(codes).toContain('IC-001')
    expect(codes).toContain('DIS-001')
  })

  it('has unique codes', () => {
    const codes = IPO_SHORT_REVIEW_CHECKLIST.map((item) => item.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('covers major categories', () => {
    const categories = new Set(IPO_SHORT_REVIEW_CHECKLIST.map((item) => item.category))
    expect(categories.has('REVENUE_RECOGNITION')).toBe(true)
    expect(categories.has('ACCOUNTS_RECEIVABLE')).toBe(true)
    expect(categories.has('INVENTORY')).toBe(true)
    expect(categories.has('FIXED_ASSETS')).toBe(true)
    expect(categories.has('TAX')).toBe(true)
    expect(categories.has('RELATED_PARTY')).toBe(true)
    expect(categories.has('INTERNAL_CONTROLS')).toBe(true)
  })

  it('severity values are valid', () => {
    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    for (const item of IPO_SHORT_REVIEW_CHECKLIST) {
      expect(validSeverities).toContain(item.severity)
    }
  })

  it('checkType values are valid', () => {
    const validTypes = ['AUTOMATED', 'MANUAL', 'SEMI_AUTOMATED']
    for (const item of IPO_SHORT_REVIEW_CHECKLIST) {
      expect(validTypes).toContain(item.checkType)
    }
  })

  it('validation rules have valid types', () => {
    const allRuleTypes = IPO_SHORT_REVIEW_CHECKLIST.flatMap((item) =>
      item.validationRules.map((r) => r.type)
    )
    for (const ruleType of allRuleTypes) {
      expect(typeof ruleType).toBe('string')
      expect(ruleType.length).toBeGreaterThan(0)
    }
  })

  it('CRITICAL severity items have aiCheckPrompt', () => {
    const criticalItems = IPO_SHORT_REVIEW_CHECKLIST.filter((item) => item.severity === 'CRITICAL')
    for (const item of criticalItems) {
      expect(item.aiCheckPrompt).toBeTruthy()
    }
  })

  it('each item has at least one related standard', () => {
    for (const item of IPO_SHORT_REVIEW_CHECKLIST) {
      expect(item.relatedStandards.length).toBeGreaterThan(0)
    }
  })

  it('contains expected item count (at least 20 items)', () => {
    expect(IPO_SHORT_REVIEW_CHECKLIST.length).toBeGreaterThanOrEqual(20)
  })
})
