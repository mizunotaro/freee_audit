import { describe, it, expect } from 'vitest'
import {
  generateDefaultMappings,
  matchSourceAccount,
  applyDefaultMappings,
} from '@/lib/conversion/default-mappings'
import type { DefaultMappingSuggestion } from '@/lib/conversion/default-mappings'

describe('generateDefaultMappings', function () {
  it('should return non-empty suggestions for USGAAP', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'USGAAP')
    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('should return non-empty suggestions for IFRS', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'IFRS')
    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('should include category mappings', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'USGAAP')
    const categoryMappings = suggestions.filter((s) => typeof s.sourceCodePattern === 'string')
    expect(categoryMappings.length).toBeGreaterThan(0)
  })

  it('should include pattern-based mappings', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'USGAAP')
    const patternMappings = suggestions.filter((s) => s.sourceCodePattern instanceof RegExp)
    expect(patternMappings.length).toBeGreaterThan(0)
  })

  it('should produce USGAAP target names for USGAAP standard', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'USGAAP')
    const categoryMapping = suggestions.find(
      (s) => typeof s.sourceCodePattern === 'string' && s.sourceCodePattern === '*:current_asset'
    )
    expect(categoryMapping).toBeDefined()
    expect(categoryMapping!.targetCode).toBe('1000')
  })

  it('should produce IFRS target names for IFRS standard', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'IFRS')
    const categoryMapping = suggestions.find(
      (s) => typeof s.sourceCodePattern === 'string' && s.sourceCodePattern === '*:current_asset'
    )
    expect(categoryMapping).toBeDefined()
    expect(categoryMapping!.targetCode).toBe('1000')
  })

  it('should have confidence values between 0 and 1', function () {
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'USGAAP')
    for (const s of suggestions) {
      expect(s.confidence).toBeGreaterThanOrEqual(0)
      expect(s.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('should have valid mappingType', function () {
    const validTypes = ['1to1', '1toN', 'Nto1', 'complex']
    const suggestions = generateDefaultMappings('src-coa', 'tgt-coa', 'USGAAP')
    for (const s of suggestions) {
      expect(validTypes).toContain(s.mappingType)
    }
  })
})

describe('matchSourceAccount', function () {
  const suggestions = generateDefaultMappings('', '', 'USGAAP')

  it('should match code 1100 to Cash and Cash Equivalents', function () {
    const match = matchSourceAccount('1100', '現金', suggestions)
    expect(match).not.toBeNull()
    expect(match!.targetCode).toBe('1100')
  })

  it('should match code 2100 to Buildings', function () {
    const match = matchSourceAccount('2100', '建物', suggestions)
    expect(match).not.toBeNull()
    expect(match!.targetCode).toBe('2100')
  })

  it('should return null for code that matches no pattern', function () {
    const match = matchSourceAccount('0000', '不明', suggestions)
    expect(match).toBeNull()
  })

  it('should match via keyword from name', function () {
    const match = matchSourceAccount('ZZ100', '売掛金', suggestions)
    expect(match).toBeNull()
  })

  it('should return null for completely unknown code and name', function () {
    const match = matchSourceAccount('ZZZZ', 'zzzz', suggestions)
    expect(match).toBeNull()
  })

  it('should match receivable codes', function () {
    const match = matchSourceAccount('1100', '売掛金', suggestions)
    expect(match).not.toBeNull()
  })
})

describe('applyDefaultMappings', function () {
  it('should map items by code pattern', function () {
    const items = [{ id: 'i1', code: '1100', name: '現金', category: 'current_asset' as const }]
    const results = applyDefaultMappings(items, 'USGAAP')
    expect(results.length).toBe(1)
    expect(results[0].sourceItemId).toBe('i1')
    expect(results[0].targetCode).toBe('1100')
  })

  it('should fall back to category mapping for unknown codes', function () {
    const items = [{ id: 'i2', code: '9999', name: '謎の科目', category: 'current_asset' as const }]
    const results = applyDefaultMappings(items, 'USGAAP')
    expect(results.length).toBe(1)
    expect(results[0].sourceItemId).toBe('i2')
    expect(results[0].confidence).toBe(0.7)
  })

  it('should return empty for empty input', function () {
    const results = applyDefaultMappings([], 'USGAAP')
    expect(results).toEqual([])
  })

  it('should handle multiple items', function () {
    const items = [
      { id: 'i1', code: '1100', name: '現金', category: 'current_asset' as const },
      { id: 'i2', code: '3100', name: '買掛金', category: 'current_liability' as const },
      { id: 'i3', code: '5100', name: '資本金', category: 'equity' as const },
    ]
    const results = applyDefaultMappings(items, 'USGAAP')
    expect(results.length).toBe(3)
  })

  it('should handle IFRS standard', function () {
    const items = [{ id: 'i1', code: '1100', name: '現金', category: 'current_asset' as const }]
    const results = applyDefaultMappings(items, 'IFRS')
    expect(results.length).toBe(1)
    expect(results[0].sourceItemId).toBe('i1')
  })
})
