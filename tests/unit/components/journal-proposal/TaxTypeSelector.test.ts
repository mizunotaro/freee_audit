import { describe, it, expect } from 'vitest'
import { getTaxTypeLabel, TAX_TYPE_OPTIONS } from '@/components/journal-proposal/TaxTypeSelector'
import type { TaxType } from '@/types/journal-proposal'

describe('TaxTypeSelector', () => {
  describe('getTaxTypeLabel', () => {
    it('should return Japanese label by default', () => {
      expect(getTaxTypeLabel('taxable_10')).toBe('課税10%')
      expect(getTaxTypeLabel('taxable_8')).toBe('課税8%')
      expect(getTaxTypeLabel('taxable_reduced_8')).toBe('軽減税率8%')
      expect(getTaxTypeLabel('tax_exempt')).toBe('非課税')
      expect(getTaxTypeLabel('non_taxable')).toBe('不課税')
      expect(getTaxTypeLabel('zero_tax')).toBe('免税')
    })

    it('should return English label when locale is en', () => {
      expect(getTaxTypeLabel('taxable_10', 'en')).toBe('Taxable 10%')
      expect(getTaxTypeLabel('taxable_8', 'en')).toBe('Taxable 8%')
      expect(getTaxTypeLabel('taxable_reduced_8', 'en')).toBe('Reduced 8%')
      expect(getTaxTypeLabel('tax_exempt', 'en')).toBe('Tax Exempt')
      expect(getTaxTypeLabel('non_taxable', 'en')).toBe('Non-Taxable')
      expect(getTaxTypeLabel('zero_tax', 'en')).toBe('Zero Tax')
    })
  })

  describe('TAX_TYPE_OPTIONS', () => {
    it('should have all tax types', () => {
      const taxTypes: TaxType[] = [
        'taxable_10',
        'taxable_8',
        'taxable_reduced_8',
        'tax_exempt',
        'non_taxable',
        'zero_tax',
      ]

      taxTypes.forEach((type) => {
        expect(TAX_TYPE_OPTIONS.find((opt) => opt.value === type)).toBeDefined()
      })
    })

    it('should have 6 options', () => {
      expect(TAX_TYPE_OPTIONS).toHaveLength(6)
    })

    it('should have label for each option', () => {
      TAX_TYPE_OPTIONS.forEach((option) => {
        expect(option.label).toBeTruthy()
        expect(typeof option.label).toBe('string')
      })
    })
  })
})
