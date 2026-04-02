import { describe, it, expect } from 'vitest'
import { BusinessReportValidator } from '@/services/reports/business-report/report-validator'

describe('BusinessReportValidator', () => {
  let validator: BusinessReportValidator

  beforeEach(function () {
    validator = new BusinessReportValidator()
  })

  describe('validateSimpleReport', () => {
    it('should pass for a complete report', function () {
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
      }

      const result = validator.validateSimpleReport(report)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for missing required fields', function () {
      const result = validator.validateSimpleReport({})

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.code === 'REQUIRED_FIELD_MISSING')).toBe(true)
    })

    it('should warn for short business overview', function () {
      const result = validator.validateSimpleReport({
        fiscalYear: 2024,
        companyName: 'Test',
        businessOverview: 'Short',
        businessEnvironment: 'x',
        managementPolicy: 'x',
        issuesAndRisks: 'x',
        financialHighlights: 'x',
        researchAndDevelopment: 'x',
        corporateGovernance: 'x',
      })

      expect(result.warnings.some((w) => w.field === 'businessOverview')).toBe(true)
    })

    it('should warn for short financial highlights', function () {
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
      }

      const result = validator.validateSimpleReport(report)

      expect(result.warnings.some((w) => w.field === 'financialHighlights')).toBe(true)
    })
  })

  describe('validateKeidanrenReport', () => {
    it('should pass for a complete Keidanren report', function () {
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
      }

      const result = validator.validateKeidanrenReport(report)

      expect(result.isValid).toBe(true)
    })

    it('should fail for missing required sections', function () {
      const result = validator.validateKeidanrenReport({})

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should warn for missing main business description', function () {
      const report = {
        companyStatus: {},
      }

      const result = validator.validateKeidanrenReport(report)

      expect(result.errors.some((e) => e.field === 'companyStatus.businessDescription')).toBe(true)
    })

    it('should warn for empty directors list', function () {
      const report = {
        officers: { directors: [] },
      }

      const result = validator.validateKeidanrenReport(report)

      expect(result.warnings.some((w) => w.field === 'officers.directors')).toBe(true)
    })
  })

  describe('checkKeidanrenCompliance', () => {
    it('should pass compliance check with all sections', function () {
      const report = {
        companyStatus: {},
        shares: {},
        officers: {},
        auditor: {},
        internalControl: {},
      }

      const result = validator.checkKeidanrenCompliance(report)

      expect(result.isCompliant).toBe(true)
      expect(result.missingRequirements).toHaveLength(0)
    })

    it('should fail compliance check with missing sections', function () {
      const result = validator.checkKeidanrenCompliance({})

      expect(result.isCompliant).toBe(false)
      expect(result.missingRequirements.length).toBeGreaterThan(0)
    })

    it('should report checked items with status', function () {
      const report = {
        companyStatus: {},
        shares: {},
      }

      const result = validator.checkKeidanrenCompliance(report)

      expect(result.checkedItems.length).toBeGreaterThan(0)
      const passItems = result.checkedItems.filter((i) => i.status === 'pass')
      const failItems = result.checkedItems.filter((i) => i.status === 'fail')
      expect(passItems.length).toBeGreaterThan(0)
      expect(failItems.length).toBeGreaterThan(0)
    })
  })

  describe('validateContent', () => {
    it('should pass for content above minimum length', function () {
      const result = validator.validateContent(
        'This is a sufficiently long content for validation purposes.'
      )

      expect(result.isValid).toBe(true)
    })

    it('should fail for empty content', function () {
      const result = validator.validateContent('')

      expect(result.isValid).toBe(false)
    })

    it('should fail for whitespace-only content', function () {
      const result = validator.validateContent('   ')

      expect(result.isValid).toBe(false)
    })

    it('should warn for short content', function () {
      const result = validator.validateContent('Too short')

      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })
})
