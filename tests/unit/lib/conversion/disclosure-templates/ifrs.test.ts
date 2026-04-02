import { describe, it, expect } from 'vitest'
import {
  IFRS_DISCLOSURE_TEMPLATES,
  getIFRSTemplate,
  getIFRSCategories,
} from '@/lib/conversion/disclosure-templates/ifrs'
import type { DisclosureTemplateContext } from '@/lib/conversion/disclosure-templates/usgaap'

function makeCtx(overrides?: Partial<DisclosureTemplateContext>): DisclosureTemplateContext {
  return {
    targetStandard: 'IFRS',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    companyName: 'Test Corp',
    adjustmentsPresent: false,
    ...overrides,
  }
}

describe('IFRS Disclosure Templates', function () {
  it('should export non-empty template record', function () {
    expect(Object.keys(IFRS_DISCLOSURE_TEMPLATES).length).toBeGreaterThan(0)
  })

  it('should have required properties on each template', function () {
    for (const [key, tmpl] of Object.entries(IFRS_DISCLOSURE_TEMPLATES)) {
      expect(tmpl.category).toBe(key)
      expect(typeof tmpl.title).toBe('string')
      expect(typeof tmpl.titleEn).toBe('string')
      expect(typeof tmpl.generateContent).toBe('function')
      expect(typeof tmpl.generateContentEn).toBe('function')
      expect(typeof tmpl.generateSections).toBe('function')
      expect(Array.isArray(tmpl.standardReferences)).toBe(true)
    }
  })

  it('should have IFRS source references', function () {
    for (const tmpl of Object.values(IFRS_DISCLOSURE_TEMPLATES)) {
      for (const ref of tmpl.standardReferences) {
        expect(ref.source).toBe('IFRS')
      }
    }
  })

  describe('significant_accounting_policies', function () {
    it('should generate Japanese content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('IFRS')
      expect(content).toContain('2024-01-01')
    })

    it('should generate English content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContentEn(makeCtx())
      expect(content).toContain('IFRS')
    })

    it('should include adjustments when present', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContent(
        makeCtx({ adjustmentsPresent: true, adjustmentList: 'テスト調整' })
      )
      expect(content).toContain('テスト調整')
    })

    it('should not include adjustments when absent', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContent(makeCtx())
      expect(content).not.toContain('主な調整事項')
    })

    it('should generate sections', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const sections = tmpl.generateSections(makeCtx())
      expect(sections.length).toBeGreaterThan(0)
      expect(sections[0]).toHaveProperty('id')
      expect(sections[0]).toHaveProperty('content')
      expect(sections[0]).toHaveProperty('contentEn')
    })
  })

  describe('basis_of_conversion', function () {
    it('should reference IFRS in content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.basis_of_conversion
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('IFRS')
      expect(content).toContain('Test Corp')
    })

    it('should reference IFRS in English content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.basis_of_conversion
      const content = tmpl.generateContentEn(makeCtx())
      expect(content).toContain('IFRS')
    })
  })

  describe('standard_differences', function () {
    it('should generate content with custom sections', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.standard_differences
      const content = tmpl.generateContent(makeCtx({ differenceSections: 'カスタム差異' }))
      expect(content).toContain('カスタム差異')
    })

    it('should generate default when no custom sections', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.standard_differences
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('JGAAPとIFRS')
    })
  })

  describe('adjusting_entries', function () {
    it('should generate content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.adjusting_entries
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('調整仕訳')
    })
  })

  describe('fair_value_measurement', function () {
    it('should reference IFRS 13', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.fair_value_measurement
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('IFRS 13')
    })
  })

  describe('foreign_currency', function () {
    it('should generate content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.foreign_currency
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('外貨換算')
    })

    it('should use custom details when provided', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.foreign_currency
      const content = tmpl.generateContent(makeCtx({ foreignCurrencyDetails: 'カスタム外貨情報' }))
      expect(content).toContain('カスタム外貨情報')
    })
  })

  describe('segment_information', function () {
    it('should generate content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.segment_information
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('セグメント情報')
    })
  })

  describe('related_party', function () {
    it('should generate content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.related_party
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('関連当事者')
    })
  })

  describe('subsequent_events', function () {
    it('should generate content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.subsequent_events
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('報告期間後')
    })
  })

  describe('commitments_contingencies', function () {
    it('should generate content', function () {
      const tmpl = IFRS_DISCLOSURE_TEMPLATES.commitments_contingencies
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('偶発事象')
    })
  })
})

describe('getIFRSTemplate', function () {
  it('should return template for valid category', function () {
    const tmpl = getIFRSTemplate('significant_accounting_policies')
    expect(tmpl).toBeDefined()
    expect(tmpl!.category).toBe('significant_accounting_policies')
  })

  it('should return undefined for unknown category', function () {
    expect(getIFRSTemplate('nonexistent')).toBeUndefined()
  })

  it('should return undefined for empty string', function () {
    expect(getIFRSTemplate('')).toBeUndefined()
  })
})

describe('getIFRSCategories', function () {
  it('should return array of category keys', function () {
    const cats = getIFRSCategories()
    expect(Array.isArray(cats)).toBe(true)
    expect(cats.length).toBeGreaterThan(0)
    expect(cats).toContain('significant_accounting_policies')
  })
})
