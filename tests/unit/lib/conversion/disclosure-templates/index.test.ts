import { describe, it, expect } from 'vitest'
import {
  getTemplate,
  getCategories,
  getAllCategories,
  CATEGORY_DISPLAY_NAMES,
  getCategoryDisplayName,
  USGAAP_DISCLOSURE_TEMPLATES,
  IFRS_DISCLOSURE_TEMPLATES,
  getUSGAAPTemplate,
  getIFRSTemplate,
} from '@/lib/conversion/disclosure-templates'
import type { DisclosureCategory } from '@/types/conversion'

describe('getTemplate', function () {
  it('should return USGAAP template for USGAAP standard', function () {
    const tmpl = getTemplate('significant_accounting_policies', 'USGAAP')
    expect(tmpl).toBeDefined()
    expect(tmpl!.category).toBe('significant_accounting_policies')
  })

  it('should return IFRS template for IFRS standard', function () {
    const tmpl = getTemplate('significant_accounting_policies', 'IFRS')
    expect(tmpl).toBeDefined()
    expect(tmpl!.category).toBe('significant_accounting_policies')
  })

  it('should return undefined for JGAAP standard', function () {
    const tmpl = getTemplate('significant_accounting_policies', 'JGAAP')
    expect(tmpl).toBeUndefined()
  })

  it('should return undefined for unknown category', function () {
    const tmpl = getTemplate('nonexistent' as DisclosureCategory, 'USGAAP')
    expect(tmpl).toBeUndefined()
  })
})

describe('getCategories', function () {
  it('should return USGAAP categories for USGAAP standard', function () {
    const cats = getCategories('USGAAP')
    expect(cats.length).toBeGreaterThan(0)
    expect(cats).toContain('significant_accounting_policies')
  })

  it('should return IFRS categories for IFRS standard', function () {
    const cats = getCategories('IFRS')
    expect(cats.length).toBeGreaterThan(0)
    expect(cats).toContain('significant_accounting_policies')
  })

  it('should return empty array for JGAAP standard', function () {
    const cats = getCategories('JGAAP')
    expect(cats).toEqual([])
  })
})

describe('getAllCategories', function () {
  it('should return array of all categories', function () {
    const cats = getAllCategories()
    expect(Array.isArray(cats)).toBe(true)
    expect(cats.length).toBeGreaterThan(0)
  })

  it('should include all required categories', function () {
    const cats = getAllCategories()
    expect(cats).toContain('significant_accounting_policies')
    expect(cats).toContain('basis_of_conversion')
    expect(cats).toContain('standard_differences')
    expect(cats).toContain('adjusting_entries')
    expect(cats).toContain('fair_value_measurement')
    expect(cats).toContain('related_party')
    expect(cats).toContain('subsequent_events')
    expect(cats).toContain('commitments_contingencies')
    expect(cats).toContain('segment_information')
    expect(cats).toContain('foreign_currency')
    expect(cats).toContain('other')
  })
})

describe('CATEGORY_DISPLAY_NAMES', function () {
  it('should have entry for each DisclosureCategory', function () {
    const allCats = getAllCategories()
    for (const cat of allCats) {
      expect(CATEGORY_DISPLAY_NAMES[cat]).toBeDefined()
      expect(CATEGORY_DISPLAY_NAMES[cat].ja).toBeTruthy()
      expect(CATEGORY_DISPLAY_NAMES[cat].en).toBeTruthy()
    }
  })

  it('should have Japanese and English display names', function () {
    expect(CATEGORY_DISPLAY_NAMES.significant_accounting_policies.ja).toBe('重要な会計方針')
    expect(CATEGORY_DISPLAY_NAMES.significant_accounting_policies.en).toBe(
      'Significant Accounting Policies'
    )
  })
})

describe('getCategoryDisplayName', function () {
  it('should return Japanese name by default', function () {
    const name = getCategoryDisplayName('significant_accounting_policies')
    expect(name).toBe('重要な会計方針')
  })

  it('should return English name when lang is en', function () {
    const name = getCategoryDisplayName('significant_accounting_policies', 'en')
    expect(name).toBe('Significant Accounting Policies')
  })

  it('should return Japanese name when lang is ja', function () {
    const name = getCategoryDisplayName('basis_of_conversion', 'ja')
    expect(name).toBe('変換の基礎')
  })

  it('should return category key for unknown category', function () {
    const name = getCategoryDisplayName('unknown_category' as DisclosureCategory)
    expect(name).toBe('unknown_category')
  })
})

describe('re-exports', function () {
  it('should re-export USGAAP_DISCLOSURE_TEMPLATES', function () {
    expect(USGAAP_DISCLOSURE_TEMPLATES).toBeDefined()
    expect(Object.keys(USGAAP_DISCLOSURE_TEMPLATES).length).toBeGreaterThan(0)
  })

  it('should re-export IFRS_DISCLOSURE_TEMPLATES', function () {
    expect(IFRS_DISCLOSURE_TEMPLATES).toBeDefined()
    expect(Object.keys(IFRS_DISCLOSURE_TEMPLATES).length).toBeGreaterThan(0)
  })

  it('should re-export getUSGAAPTemplate', function () {
    expect(typeof getUSGAAPTemplate).toBe('function')
  })

  it('should re-export getIFRSTemplate', function () {
    expect(typeof getIFRSTemplate).toBe('function')
  })
})
