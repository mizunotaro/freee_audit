import { describe, it, expect } from 'vitest'
import {
  USGAAP_COA_TEMPLATE,
  USGAAP_COA_METADATA,
} from '@/lib/conversion/templates/usgaap-coa-template'

describe('USGAAP_COA_TEMPLATE', function () {
  it('should be a non-empty array', function () {
    expect(Array.isArray(USGAAP_COA_TEMPLATE)).toBe(true)
    expect(USGAAP_COA_TEMPLATE.length).toBeGreaterThan(0)
  })

  it('should have all items with required properties', function () {
    for (const item of USGAAP_COA_TEMPLATE) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('code')
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('nameEn')
      expect(item).toHaveProperty('standard')
      expect(item).toHaveProperty('category')
      expect(item).toHaveProperty('normalBalance')
      expect(item).toHaveProperty('level')
      expect(item).toHaveProperty('isConvertible')
      expect(item.standard).toBe('USGAAP')
    }
  })

  it('should have unique ids', function () {
    const ids = USGAAP_COA_TEMPLATE.map((i) => i.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have unique codes at each level', function () {
    const codes = USGAAP_COA_TEMPLATE.map((i) => i.code)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })

  it('should contain root-level items (level 0)', function () {
    const roots = USGAAP_COA_TEMPLATE.filter((i) => i.level === 0)
    expect(roots.length).toBeGreaterThan(0)
  })

  it('should contain child items (level > 0)', function () {
    const children = USGAAP_COA_TEMPLATE.filter((i) => i.level > 0)
    expect(children.length).toBeGreaterThan(0)
  })

  it('should have parentId for non-root items', function () {
    const children = USGAAP_COA_TEMPLATE.filter((i) => i.level > 0)
    for (const child of children) {
      expect(child.parentId).toBeDefined()
    }
  })

  it('should have Cash and Cash Equivalents', function () {
    const cash = USGAAP_COA_TEMPLATE.find((i) => i.code === '1100')
    expect(cash).toBeDefined()
    expect(cash!.nameEn).toBe('Cash and Cash Equivalents')
  })

  it('should have Revenue', function () {
    const revenue = USGAAP_COA_TEMPLATE.find((i) => i.code === '6100')
    expect(revenue).toBeDefined()
    expect(revenue!.category).toBe('revenue')
  })

  it('should cover asset categories', function () {
    const assets = USGAAP_COA_TEMPLATE.filter(
      (i) =>
        i.category === 'current_asset' ||
        i.category === 'fixed_asset' ||
        i.category === 'deferred_asset'
    )
    expect(assets.length).toBeGreaterThan(0)
  })

  it('should cover liability categories', function () {
    const liabilities = USGAAP_COA_TEMPLATE.filter((i) => i.category.includes('liability'))
    expect(liabilities.length).toBeGreaterThan(0)
  })

  it('should cover equity', function () {
    const equity = USGAAP_COA_TEMPLATE.filter((i) => i.category === 'equity')
    expect(equity.length).toBeGreaterThan(0)
  })

  it('should have all items be convertible', function () {
    const nonConvertible = USGAAP_COA_TEMPLATE.filter((i) => !i.isConvertible)
    expect(nonConvertible.length).toBe(0)
  })
})

describe('USGAAP_COA_METADATA', function () {
  it('should have correct standard', function () {
    expect(USGAAP_COA_METADATA.standard).toBe('USGAAP')
  })

  it('should have non-empty name', function () {
    expect(USGAAP_COA_METADATA.name).toBeTruthy()
    expect(USGAAP_COA_METADATA.nameEn).toBeTruthy()
  })

  it('should have version', function () {
    expect(USGAAP_COA_METADATA.version).toBe(1)
  })

  it('should have totalItems matching template length', function () {
    expect(USGAAP_COA_METADATA.totalItems).toBe(USGAAP_COA_TEMPLATE.length)
  })

  it('should have positive category counts', function () {
    expect(USGAAP_COA_METADATA.categories.assets).toBeGreaterThan(0)
    expect(USGAAP_COA_METADATA.categories.liabilities).toBeGreaterThan(0)
    expect(USGAAP_COA_METADATA.categories.equity).toBeGreaterThan(0)
    expect(USGAAP_COA_METADATA.categories.revenue).toBeGreaterThan(0)
    expect(USGAAP_COA_METADATA.categories.expenses).toBeGreaterThan(0)
  })
})
