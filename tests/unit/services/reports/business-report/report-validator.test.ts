import { describe, it, expect, beforeEach } from 'vitest'
import { BusinessReportValidator } from '@/services/reports/business-report/report-validator'

describe('BusinessReportValidator', () => {
  let validator: BusinessReportValidator

  beforeEach(() => {
    validator = new BusinessReportValidator()
  })

  describe('validateSimpleReport', () => {
    it('should pass for a complete report', () => {
      const report = {
        fiscalYear: 2024,
        companyName: 'Test Corp',
        businessOverview:
          'A comprehensive overview of the business operations and activities that span multiple areas.',
        businessEnvironment: 'The business environment is competitive.',
        managementPolicy: 'Growth-oriented management policy.',
        issuesAndRisks: 'Key risks include market volatility.',
        financialHighlights:
          'Revenue grew 10% YoY with strong operating margins and cash flow generation.',
        researchAndDevelopment: 'Focus on AI and machine learning technologies.',
        corporateGovernance: 'Robust governance framework with independent directors.',
      } as any

      const result = validator.validateSimpleReport(report as any)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for missing required fields', () => {
      const result = validator.validateSimpleReport({} as any)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.code === 'REQUIRED_FIELD_MISSING')).toBe(true)
    })

    it('should warn for short business overview', () => {
      const report = {
        fiscalYear: 2024,
        companyName: 'Test',
        businessOverview: 'Short',
        businessEnvironment: 'x',
        managementPolicy: 'x',
        issuesAndRisks: 'x',
        financialHighlights: 'x',
        researchAndDevelopment: 'x',
        corporateGovernance: 'x',
      } as any

      const result = validator.validateSimpleReport(report as any)

      expect(result.warnings.some((w) => w.field === 'businessOverview')).toBe(true)
    })

    it('should warn for short financial highlights', () => {
      const report = {
        fiscalYear: 2024,
        companyName: 'Test',
        businessOverview: 'A comprehensive overview of the business operations and activities.',
        businessEnvironment: 'x',
        managementPolicy: 'x',
        issuesAndRisks: 'x',
        financialHighlights: 'Short',
        researchAndDevelopment: 'x',
        corporateGovernance: 'x',
      } as any

      const result = validator.validateSimpleReport(report as any)

      expect(result.warnings.some((w) => w.field === 'financialHighlights')).toBe(true)
    })
  })

  describe('validateKeidanrenReport', () => {
    it('should pass for a complete Keidanren report', () => {
      const report = {
        companyStatus: {
          businessDescription: { mainBusiness: 'Technology consulting' },
          businessPerformance: { analysis: 'Strong growth' },
        },
        shares: { totalShares: 1000000 },
        stockOptions: { hasPlan: false },
        officers: { directors: [{ name: 'Test Director' }] },
        auditor: { name: 'Test Auditor' },
        internalControl: { description: 'Comprehensive controls' },
        controlPolicy: { policy: 'Strict controls' },
        subsidiary: { hasSubsidiary: false },
        relatedPartyTransactions: { hasTransactions: false },
        importantMatters: { matters: [] },
      } as any

      const result = validator.validateKeidanrenReport(report as any)

      expect(result.isValid).toBe(true)
    })

    it('should fail for missing required sections', () => {
      const result = validator.validateKeidanrenReport({} as any)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should error for missing main business description', () => {
      const report = {
        companyStatus: {},
      } as any

      const result = validator.validateKeidanrenReport(report as any)

      expect(result.errors.some((e) => e.field === 'companyStatus.businessDescription')).toBe(true)
    })

    it('should warn for empty directors list', () => {
      const report = {
        officers: { directors: [] },
      } as any

      const result = validator.validateKeidanrenReport(report as any)

      expect(result.warnings.some((w) => w.field === 'officers.directors')).toBe(true)
    })
  })

  describe('checkKeidanrenCompliance', () => {
    it('should pass compliance check with all sections', () => {
      const report = {
        companyStatus: {},
        shares: {},
        officers: {},
        auditor: {},
        internalControl: {},
      } as any

      const result = validator.checkKeidanrenCompliance(report as any)

      expect(result.isCompliant).toBe(true)
      expect(result.missingRequirements).toHaveLength(0)
    })

    it('should fail compliance check with missing sections', () => {
      const result = validator.checkKeidanrenCompliance({} as any)

      expect(result.isCompliant).toBe(false)
      expect(result.missingRequirements.length).toBeGreaterThan(0)
    })

    it('should report checked items with status', () => {
      const report = {
        companyStatus: {},
        shares: {},
      } as any

      const result = validator.checkKeidanrenCompliance(report as any)

      expect(result.checkedItems.length).toBeGreaterThan(0)
      const passItems = result.checkedItems.filter((i) => i.status === 'pass')
      const failItems = result.checkedItems.filter((i) => i.status === 'fail')
      expect(passItems.length).toBeGreaterThan(0)
      expect(failItems.length).toBeGreaterThan(0)
    })
  })

  describe('validateContent', () => {
    it('should pass for content above minimum length', () => {
      const result = validator.validateContent(
        'This is a sufficiently long content for validation purposes.'
      )

      expect(result.isValid).toBe(true)
    })

    it('should fail for empty content', () => {
      const result = validator.validateContent('')

      expect(result.isValid).toBe(false)
    })

    it('should fail for whitespace-only content', () => {
      const result = validator.validateContent('   ')

      expect(result.isValid).toBe(false)
    })

    it('should warn for short content', () => {
      const result = validator.validateContent('Too short')

      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })
})
