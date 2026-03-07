import { describe, it, expect } from 'vitest'
import { COAValidator } from '@/lib/conversion/coa-validator'

describe('COAValidator', () => {
  const validator = new COAValidator()

  describe('validateItem', () => {
    it('should pass valid item', () => {
      const errors = validator.validateItem({
        id: 'item-1',
        code: '1000',
        name: '現金及び預金',
        nameEn: 'Cash and Cash Equivalents',
        standard: 'JGAAP',
        category: 'current_asset',
        normalBalance: 'debit',
        level: 0,
        isConvertible: true,
      })

      expect(errors).toHaveLength(0)
    })

    it('should fail with missing code', () => {
      const errors = validator.validateItem({
        code: '',
        name: '現金及び預金',
        nameEn: 'Cash',
        category: 'current_asset',
        normalBalance: 'debit',
      })

      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.code === 'REQUIRED_FIELD' && e.field === 'code')).toBe(true)
    })

    it('should fail with invalid code format', () => {
      const errors = validator.validateItem({
        code: 'invalid code!',
        name: '現金及び預金',
        nameEn: 'Cash',
        category: 'current_asset',
        normalBalance: 'debit',
      })

      expect(errors.some((e) => e.code === 'INVALID_CODE_FORMAT')).toBe(true)
    })

    it('should fail with missing name', () => {
      const errors = validator.validateItem({
        code: '1000',
        name: '',
        nameEn: 'Cash',
        category: 'current_asset',
        normalBalance: 'debit',
      })

      expect(errors.some((e) => e.code === 'REQUIRED_FIELD' && e.field === 'name')).toBe(true)
    })

    it('should fail with invalid category', () => {
      const errors = validator.validateItem({
        code: '1000',
        name: '現金',
        nameEn: 'Cash',
        category: 'invalid_category' as any,
        normalBalance: 'debit',
      })

      expect(errors.some((e) => e.code === 'INVALID_CATEGORY')).toBe(true)
    })

    it('should fail with invalid normal balance', () => {
      const errors = validator.validateItem({
        code: '1000',
        name: '現金',
        nameEn: 'Cash',
        category: 'current_asset',
        normalBalance: 'invalid' as any,
      })

      expect(errors.some((e) => e.code === 'INVALID_NORMAL_BALANCE')).toBe(true)
    })

    it('should fail with invalid level', () => {
      const errors = validator.validateItem({
        code: '1000',
        name: '現金',
        nameEn: 'Cash',
        category: 'current_asset',
        normalBalance: 'debit',
        level: 10,
      })

      expect(errors.some((e) => e.code === 'INVALID_LEVEL')).toBe(true)
    })
  })

  describe('validateCOA', () => {
    it('should pass valid COA', () => {
      const result = validator.validateCOA({
        id: 'coa-1',
        companyId: 'company-1',
        standard: 'JGAAP',
        name: 'Test COA',
        items: [
          {
            id: 'item-1',
            code: '1000',
            name: '現金',
            nameEn: 'Cash',
            standard: 'JGAAP',
            category: 'current_asset',
            normalBalance: 'debit',
            level: 0,
            isConvertible: true,
          },
        ],
        version: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail with missing companyId', () => {
      const result = validator.validateCOA({
        standard: 'JGAAP',
        name: 'Test COA',
        items: [],
      } as any)

      expect(result.isValid).toBe(false)
      expect(
        result.errors.some((e) => e.code === 'REQUIRED_FIELD' && e.field === 'companyId')
      ).toBe(true)
    })

    it('should fail with no items', () => {
      const result = validator.validateCOA({
        companyId: 'company-1',
        standard: 'JGAAP',
        name: 'Test COA',
        items: [],
      } as any)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'NO_ITEMS')).toBe(true)
    })

    it('should detect duplicate codes', () => {
      const result = validator.validateCOA({
        companyId: 'company-1',
        standard: 'JGAAP',
        name: 'Test COA',
        items: [
          {
            id: 'item-1',
            code: '1000',
            name: '現金1',
            nameEn: 'Cash 1',
            category: 'current_asset',
            normalBalance: 'debit',
            level: 0,
            isConvertible: true,
          },
          {
            id: 'item-2',
            code: '1000',
            name: '現金2',
            nameEn: 'Cash 2',
            category: 'current_asset',
            normalBalance: 'debit',
            level: 0,
            isConvertible: true,
          },
        ],
      } as any)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'DUPLICATE_CODE')).toBe(true)
    })
  })

  describe('detectCircularReferences', () => {
    it('should detect circular references', () => {
      const result = validator.validateCOA({
        companyId: 'company-1',
        standard: 'JGAAP',
        name: 'Test COA',
        items: [
          {
            id: 'item-1',
            code: '1000',
            name: 'Parent',
            nameEn: 'Parent',
            category: 'current_asset',
            normalBalance: 'debit',
            parentId: 'item-2',
            level: 1,
            isConvertible: true,
          },
          {
            id: 'item-2',
            code: '1100',
            name: 'Child',
            nameEn: 'Child',
            category: 'current_asset',
            normalBalance: 'debit',
            parentId: 'item-1',
            level: 2,
            isConvertible: true,
          },
        ],
      } as any)

      expect(result.errors.some((e) => e.code === 'CIRCULAR_REFERENCE')).toBe(true)
    })
  })

  describe('detectOrphanItems', () => {
    it('should warn about orphan items', () => {
      const result = validator.validateCOA({
        companyId: 'company-1',
        standard: 'JGAAP',
        name: 'Test COA',
        items: [
          {
            id: 'item-1',
            code: '1000',
            name: '現金',
            nameEn: 'Cash',
            category: 'current_asset',
            normalBalance: 'debit',
            level: 0,
            isConvertible: true,
          },
          {
            id: 'item-2',
            code: '1100',
            name: '子科目',
            nameEn: 'Sub Account',
            category: 'current_asset',
            normalBalance: 'debit',
            parentId: 'non-existent-parent',
            level: 1,
            isConvertible: true,
          },
        ],
      } as any)

      expect(result.warnings.some((e) => e.code === 'ORPHAN_ITEM')).toBe(true)
    })
  })

  describe('validateCategoryConsistency', () => {
    it('should detect category mismatch between parent and child', () => {
      const errors = validator.validateCategoryConsistency([
        {
          id: 'item-1',
          code: '1000',
          name: 'Parent',
          nameEn: 'Parent',
          category: 'current_asset',
          normalBalance: 'debit',
          level: 0,
          isConvertible: true,
        },
        {
          id: 'item-2',
          code: '1100',
          name: 'Child',
          nameEn: 'Child',
          category: 'revenue',
          normalBalance: 'credit',
          parentId: 'item-1',
          level: 1,
          isConvertible: true,
        },
      ])

      expect(errors.some((e) => e.code === 'CATEGORY_MISMATCH')).toBe(true)
    })
  })
})
