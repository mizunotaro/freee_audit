import { describe, it, expect } from 'vitest'
import { IFRS_COA_TEMPLATE, IFRS_COA_METADATA } from '@/lib/conversion/templates/ifrs-coa-template'

describe('IFRS_COA_TEMPLATE', function () {
  it('should be a non-empty array', function () {
    expect(Array.isArray(IFRS_COA_TEMPLATE)).toBe(true)
    expect(IFRS_COA_TEMPLATE.length).toBeGreaterThan(0)
  })

  it('should have all items with required properties', function () {
    for (const item of IFRS_COA_TEMPLATE) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('code')
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('nameEn')
      expect(item).toHaveProperty('standard')
      expect(item).toHaveProperty('category')
      expect(item).toHaveProperty('normalBalance')
      expect(item).toHaveProperty('level')
      expect(item).toHaveProperty('isConvertible')
      expect(item.standard).toBe('IFRS')
    }
  })

  it('should have unique ids', function () {
    const ids = IFRS_COA_TEMPLATE.map((i) => i.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have unique codes', function () {
    const codes = IFRS_COA_TEMPLATE.map((i) => i.code)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })

  it('should contain root-level items (level 0)', function () {
    const roots = IFRS_COA_TEMPLATE.filter((i) => i.level === 0)
    expect(roots.length).toBeGreaterThan(0)
  })

  it('should contain child items (level > 0)', function () {
    const children = IFRS_COA_TEMPLATE.filter((i) => i.level > 0)
    expect(children.length).toBeGreaterThan(0)
  })

  it('should have parentId for non-root items', function () {
    const children = IFRS_COA_TEMPLATE.filter((i) => i.level > 0)
    for (const child of children) {
      expect(child.parentId).toBeDefined()
    }
  })

  it('should have Cash and Cash Equivalents', function () {
    const cash = IFRS_COA_TEMPLATE.find((i) => i.code === '1100')
    expect(cash).toBeDefined()
    expect(cash!.nameEn).toBe('Cash and Cash Equivalents')
  })

  it('should have Revenue', function () {
    const revenue = IFRS_COA_TEMPLATE.find((i) => i.code === '6100')
    expect(revenue).toBeDefined()
    expect(revenue!.category).toBe('revenue')
  })

  it('should cover asset categories', function () {
    const assets = IFRS_COA_TEMPLATE.filter(
      (i) =>
        i.category === 'current_asset' ||
        i.category === 'fixed_asset' ||
        i.category === 'deferred_asset'
    )
    expect(assets.length).toBeGreaterThan(0)
  })

  it('should cover liability categories', function () {
    const liabilities = IFRS_COA_TEMPLATE.filter((i) => i.category.includes('liability'))
    expect(liabilities.length).toBeGreaterThan(0)
  })

  it('should cover equity', function () {
    const equity = IFRS_COA_TEMPLATE.filter((i) => i.category === 'equity')
    expect(equity.length).toBeGreaterThan(0)
  })

  it('should have Right-of-Use Assets (IFRS specific)', function () {
    const rou = IFRS_COA_TEMPLATE.find((i) => i.code === '2140')
    expect(rou).toBeDefined()
    expect(rou!.nameEn).toBe('Right-of-Use Assets')
  })

  it('should have all items be convertible', function () {
    const nonConvertible = IFRS_COA_TEMPLATE.filter((i) => !i.isConvertible)
    expect(nonConvertible.length).toBe(0)
  })
})

describe('IFRS_COA_METADATA', function () {
  it('should have correct standard', function () {
    expect(IFRS_COA_METADATA.standard).toBe('IFRS')
  })

  it('should have non-empty name', function () {
    expect(IFRS_COA_METADATA.name).toBeTruthy()
    expect(IFRS_COA_METADATA.nameEn).toBeTruthy()
  })

  it('should have version', function () {
    expect(IFRS_COA_METADATA.version).toBe(1)
  })

  it('should have totalItems matching template length', function () {
    expect(IFRS_COA_METADATA.totalItems).toBe(IFRS_COA_TEMPLATE.length)
  })

  it('should have positive category counts', function () {
    expect(IFRS_COA_METADATA.categories.assets).toBeGreaterThan(0)
    expect(IFRS_COA_METADATA.categories.liabilities).toBeGreaterThan(0)
    expect(IFRS_COA_METADATA.categories.equity).toBeGreaterThan(0)
    expect(IFRS_COA_METADATA.categories.revenue).toBeGreaterThan(0)
    expect(IFRS_COA_METADATA.categories.expenses).toBeGreaterThan(0)
  })
})
