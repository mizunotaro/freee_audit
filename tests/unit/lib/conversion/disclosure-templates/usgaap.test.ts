import { describe, it, expect } from 'vitest'
import {
  USGAAP_DISCLOSURE_TEMPLATES,
  getUSGAAPTemplate,
  getUSGAAPCategories,
} from '@/lib/conversion/disclosure-templates/usgaap'
import type { DisclosureTemplateContext } from '@/lib/conversion/disclosure-templates/usgaap'

function makeCtx(overrides?: Partial<DisclosureTemplateContext>): DisclosureTemplateContext {
  return {
    targetStandard: 'USGAAP',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    companyName: 'Test Corp',
    adjustmentsPresent: false,
    ...overrides,
  }
}

describe('USGAAP Disclosure Templates', function () {
  it('should export non-empty template record', function () {
    expect(Object.keys(USGAAP_DISCLOSURE_TEMPLATES).length).toBeGreaterThan(0)
  })

  it('should have required properties on each template', function () {
    for (const [key, tmpl] of Object.entries(USGAAP_DISCLOSURE_TEMPLATES)) {
      expect(tmpl.category).toBe(key)
      expect(typeof tmpl.title).toBe('string')
      expect(typeof tmpl.titleEn).toBe('string')
      expect(typeof tmpl.generateContent).toBe('function')
      expect(typeof tmpl.generateContentEn).toBe('function')
      expect(typeof tmpl.generateSections).toBe('function')
      expect(Array.isArray(tmpl.standardReferences)).toBe(true)
    }
  })

  describe('significant_accounting_policies', function () {
    it('should generate Japanese content without adjustments', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('USGAAP')
      expect(content).toContain('2024-01-01')
      expect(content).toContain('2024-12-31')
      expect(content).not.toContain('主な調整事項')
    })

    it('should generate Japanese content with adjustments', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContent(
        makeCtx({ adjustmentsPresent: true, adjustmentList: 'テスト調整' })
      )
      expect(content).toContain('主な調整事項')
      expect(content).toContain('テスト調整')
    })

    it('should generate English content without adjustments', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContentEn(makeCtx())
      expect(content).toContain('USGAAP')
      expect(content).not.toContain('Significant Adjustments')
    })

    it('should generate English content with adjustments', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const content = tmpl.generateContentEn(
        makeCtx({ adjustmentsPresent: true, adjustmentList: 'Test adjustment' })
      )
      expect(content).toContain('Significant Adjustments')
      expect(content).toContain('Test adjustment')
    })

    it('should generate sections', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.significant_accounting_policies
      const sections = tmpl.generateSections(makeCtx())
      expect(sections.length).toBeGreaterThanOrEqual(2)
      expect(sections[0]).toHaveProperty('id')
      expect(sections[0]).toHaveProperty('title')
      expect(sections[0]).toHaveProperty('titleEn')
      expect(sections[0]).toHaveProperty('content')
      expect(sections[0]).toHaveProperty('contentEn')
      expect(sections[0]).toHaveProperty('order')
    })

    it('should have ASC references', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.significant_accounting_policies
      expect(tmpl.standardReferences.length).toBeGreaterThan(0)
      expect(tmpl.standardReferences[0].source).toBe('USGAAP')
    })
  })

  describe('basis_of_conversion', function () {
    it('should generate content with company name', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.basis_of_conversion
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('Test Corp')
      expect(content).toContain('USGAAP')
    })

    it('should generate English content', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.basis_of_conversion
      const content = tmpl.generateContentEn(makeCtx())
      expect(content).toContain('Test Corp')
      expect(content).toContain('USGAAP')
    })
  })

  describe('standard_differences', function () {
    it('should generate content with default when no differenceSections', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.standard_differences
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('JGAAPとUSGAAPの主な差異')
    })

    it('should generate content with custom differenceSections', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.standard_differences
      const content = tmpl.generateContent(
        makeCtx({ differenceSections: 'カスタム差異', differenceTable: '| A | B |' })
      )
      expect(content).toContain('カスタム差異')
      expect(content).toContain('| A | B |')
    })
  })

  describe('adjusting_entries', function () {
    it('should generate content with defaults', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.adjusting_entries
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('調整仕訳の概要')
    })

    it('should generate content with custom details', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.adjusting_entries
      const content = tmpl.generateContent(
        makeCtx({ adjustmentDetails: 'カスタム調整', impactTable: '| X | Y |' })
      )
      expect(content).toContain('カスタム調整')
      expect(content).toContain('| X | Y |')
    })
  })

  describe('fair_value_measurement', function () {
    it('should generate content', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.fair_value_measurement
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('公正価値')
    })

    it('should generate sections', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.fair_value_measurement
      const sections = tmpl.generateSections(makeCtx())
      expect(sections.length).toBeGreaterThan(0)
    })
  })

  describe('related_party', function () {
    it('should generate content ignoring context', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.related_party
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('関連当事者')
    })
  })

  describe('subsequent_events', function () {
    it('should generate content', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.subsequent_events
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('後発事象')
    })
  })

  describe('commitments_contingencies', function () {
    it('should generate content', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.commitments_contingencies
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('偶発事象')
    })
  })

  describe('segment_information', function () {
    it('should generate content with custom segment details', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.segment_information
      const content = tmpl.generateContent(makeCtx({ segmentDetails: 'カスタムセグメント' }))
      expect(content).toContain('カスタムセグメント')
    })
  })

  describe('foreign_currency', function () {
    it('should generate content with default', function () {
      const tmpl = USGAAP_DISCLOSURE_TEMPLATES.foreign_currency
      const content = tmpl.generateContent(makeCtx())
      expect(content).toContain('外貨換算')
    })
  })
})

describe('getUSGAAPTemplate', function () {
  it('should return template for valid category', function () {
    const tmpl = getUSGAAPTemplate('significant_accounting_policies')
    expect(tmpl).toBeDefined()
    expect(tmpl!.category).toBe('significant_accounting_policies')
  })

  it('should return undefined for unknown category', function () {
    expect(getUSGAAPTemplate('nonexistent')).toBeUndefined()
  })

  it('should return undefined for empty string', function () {
    expect(getUSGAAPTemplate('')).toBeUndefined()
  })
})

describe('getUSGAAPCategories', function () {
  it('should return array of category keys', function () {
    const cats = getUSGAAPCategories()
    expect(Array.isArray(cats)).toBe(true)
    expect(cats.length).toBeGreaterThan(0)
    expect(cats).toContain('significant_accounting_policies')
    expect(cats).toContain('basis_of_conversion')
  })
})
