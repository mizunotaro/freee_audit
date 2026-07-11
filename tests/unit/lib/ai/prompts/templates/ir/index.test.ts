import { describe, it, expect } from 'vitest'
import {
  getAll,
  getById,
  getBySectionType,
  registerTemplate,
  getTemplate,
  irPromptRegistry,
  IR_TEMPLATES_LIST,
  getTopMessageTemplate,
  getFinancialHighlightsTemplate,
  getDividendPolicyTemplate,
  getMidtermPlanTemplate,
  getESGInfoTemplate,
  getRiskFactorsTemplate,
} from '@/lib/ai/prompts/templates/ir'
import type { IRPromptTemplate, IRPromptSectionType } from '@/lib/ai/prompts/templates/ir'

const EXPECTED: ReadonlyArray<{
  id: string
  sectionType: IRPromptSectionType
}> = [
  { id: 'ir-top-message', sectionType: 'TOP_MESSAGE' },
  { id: 'ir-financial-highlights', sectionType: 'FINANCIAL_HIGHLIGHTS' },
  { id: 'ir-dividend-policy', sectionType: 'DIVIDEND_POLICY' },
  { id: 'ir-midterm-plan', sectionType: 'MIDTERM_PLAN' },
  { id: 'ir-esg-info', sectionType: 'ESG_INFO' },
  { id: 'ir-risk-factors', sectionType: 'RISK_FACTORS' },
]

describe('IR prompt template registry', () => {
  describe('getAll', () => {
    it('returns every registered template', () => {
      const all = getAll()
      expect(all).toHaveLength(EXPECTED.length)
      for (const expected of EXPECTED) {
        expect(
          all.some((t) => t.id === expected.id && t.sectionType === expected.sectionType)
        ).toBe(true)
      }
    })

    it('returns a readonly snapshot unaffected by later mutation of the result', () => {
      const before = getAll()
      expect(before).toHaveLength(EXPECTED.length)
    })
  })

  describe('IR_TEMPLATES_LIST', () => {
    it('equals the result of getAll', () => {
      expect(IR_TEMPLATES_LIST).toHaveLength(EXPECTED.length)
      expect(IR_TEMPLATES_LIST.map((t) => t.id).sort()).toEqual(
        getAll()
          .map((t) => t.id)
          .sort()
      )
    })
  })

  describe('getById', () => {
    it('returns the template for a known id', () => {
      const tmpl = getById('ir-top-message')
      expect(tmpl).toBeDefined()
      expect(tmpl?.sectionType).toBe('TOP_MESSAGE')
    })

    it('returns undefined for an unknown id', () => {
      expect(getById('does-not-exist')).toBeUndefined()
    })
  })

  describe('getBySectionType', () => {
    it('returns the template for a known section type', () => {
      const tmpl = getBySectionType('FINANCIAL_HIGHLIGHTS')
      expect(tmpl).toBeDefined()
      expect(tmpl?.id).toBe('ir-financial-highlights')
    })

    it('returns undefined for an unknown section type', () => {
      expect(getBySectionType('UNKNOWN_SECTION' as IRPromptSectionType)).toBeUndefined()
    })

    it('maps each expected section type to its template', () => {
      for (const expected of EXPECTED) {
        const tmpl = getBySectionType(expected.sectionType)
        expect(tmpl).toBeDefined()
        expect(tmpl?.id).toBe(expected.id)
      }
    })
  })

  describe('getTemplate', () => {
    it('resolves by id', () => {
      const tmpl = getTemplate('ir-dividend-policy')
      expect(tmpl).toBeDefined()
      expect(tmpl?.sectionType).toBe('DIVIDEND_POLICY')
    })

    it('resolves by section type when no id matches', () => {
      const tmpl = getTemplate('ESG_INFO')
      expect(tmpl).toBeDefined()
      expect(tmpl?.id).toBe('ir-esg-info')
    })

    it('returns undefined for an unknown id or section type', () => {
      expect(getTemplate('no-such-id-or-section')).toBeUndefined()
    })

    it('prefers an id match over a section-type match', () => {
      const byId = getTemplate('ir-midterm-plan')
      const bySection = getTemplate('MIDTERM_PLAN')
      expect(byId?.id).toBe('ir-midterm-plan')
      expect(bySection?.id).toBe('ir-midterm-plan')
    })
  })

  describe('irPromptRegistry', () => {
    it('exposes the templates map keyed by id', () => {
      expect(irPromptRegistry.templates).toBeInstanceOf(Map)
      expect(irPromptRegistry.templates.size).toBe(EXPECTED.length)
      for (const expected of EXPECTED) {
        expect(irPromptRegistry.templates.get(expected.id)?.sectionType).toBe(expected.sectionType)
      }
    })

    it('delegates getBySectionType to the registry lookup', () => {
      expect(irPromptRegistry.getBySectionType('RISK_FACTORS')?.id).toBe('ir-risk-factors')
      expect(irPromptRegistry.getBySectionType('NOPE' as IRPromptSectionType)).toBeUndefined()
    })

    it('delegates getAll to the full template list', () => {
      expect(irPromptRegistry.getAll()).toHaveLength(EXPECTED.length)
    })
  })

  describe('re-exported per-template getters', () => {
    const cases: Array<{ name: string; get: () => IRPromptTemplate; id: string }> = [
      { name: 'getTopMessageTemplate', get: getTopMessageTemplate, id: 'ir-top-message' },
      {
        name: 'getFinancialHighlightsTemplate',
        get: getFinancialHighlightsTemplate,
        id: 'ir-financial-highlights',
      },
      {
        name: 'getDividendPolicyTemplate',
        get: getDividendPolicyTemplate,
        id: 'ir-dividend-policy',
      },
      { name: 'getMidtermPlanTemplate', get: getMidtermPlanTemplate, id: 'ir-midterm-plan' },
      { name: 'getESGInfoTemplate', get: getESGInfoTemplate, id: 'ir-esg-info' },
      { name: 'getRiskFactorsTemplate', get: getRiskFactorsTemplate, id: 'ir-risk-factors' },
    ]

    it.each(cases)('$name returns the matching registry template', ({ get, id }) => {
      const tmpl = get()
      expect(tmpl.id).toBe(id)
      expect(tmpl).toBe(getById(id))
    })

    it('every getter result is present in getAll', () => {
      const allIds = new Set(getAll().map((t) => t.id))
      for (const { get } of cases) {
        expect(allIds.has(get().id)).toBe(true)
      }
    })
  })

  describe('registerTemplate', () => {
    const customTemplate: IRPromptTemplate = {
      id: 'ir-test-custom-section',
      sectionType: 'RISK_FACTORS',
      persona: 'cfo',
      systemPrompt: { ja: 'カスタムシステムプロンプト', en: 'custom system prompt' },
      userPromptTemplate: {
        ja: 'カスタムユーザープロンプト {{companyName}}',
        en: 'custom {{companyName}}',
      },
      variables: ['companyName'],
      outputFormat: 'markdown',
      temperature: 0.2,
    }

    it('fails with TEMPLATE_ALREADY_EXISTS for a duplicate id', () => {
      const duplicate: IRPromptTemplate = {
        ...customTemplate,
        id: 'ir-top-message',
      }
      const result = registerTemplate(duplicate)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('TEMPLATE_ALREADY_EXISTS')
        expect(result.error.message).toContain('ir-top-message')
      }
    })

    it('succeeds for a new id and makes the template retrievable by id', () => {
      const result = registerTemplate(customTemplate)
      expect(result.success).toBe(true)
      expect(getById('ir-test-custom-section')).toBe(customTemplate)
      expect(getTemplate('ir-test-custom-section')).toBe(customTemplate)
    })
  })
})
